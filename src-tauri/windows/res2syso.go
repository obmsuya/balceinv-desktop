package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"sort"
)

const (
	machineAmd64               = 0x8664
	resourceSectionFlags       = 0x40000040
	relocationAmd64Addr32Nb    = 3
	symbolClassStatic          = 3
	fileHeaderSize             = 20
	sectionHeaderSize          = 40
	relocationSize             = 10
	directoryHeaderSize        = 16
	directoryEntrySize         = 8
	dataEntrySize              = 16
	subdirectoryFlag           = 0x80000000
	ordinalMarker              = 0xFFFF
	resourceDataAlignment      = 8
	resourceFileEntryAlignment = 4
)

type resource struct {
	typeId     uint16
	nameId     uint16
	languageId uint16
	data       []byte
}

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: go run res2syso.go <input.res> <output.syso>")
		os.Exit(2)
	}
	compiledResourceBytes, readError := os.ReadFile(os.Args[1])
	if readError != nil {
		fmt.Fprintln(os.Stderr, fmt.Errorf("read compiled resources: %w", readError))
		os.Exit(1)
	}
	resources, parseError := parseCompiledResources(compiledResourceBytes)
	if parseError != nil {
		fmt.Fprintln(os.Stderr, fmt.Errorf("parse %s: %w", os.Args[1], parseError))
		os.Exit(1)
	}
	objectBytes := buildResourceObject(resources)
	writeError := os.WriteFile(os.Args[2], objectBytes, 0o644)
	if writeError != nil {
		fmt.Fprintln(os.Stderr, fmt.Errorf("write object: %w", writeError))
		os.Exit(1)
	}
	fmt.Printf("%d resources written to %s\n", len(resources), os.Args[2])
}

func parseCompiledResources(compiledResourceBytes []byte) ([]resource, error) {
	var resources []resource
	entryOffset := 0
	for entryOffset+8 <= len(compiledResourceBytes) {
		dataSize := int(binary.LittleEndian.Uint32(compiledResourceBytes[entryOffset:]))
		headerSize := int(binary.LittleEndian.Uint32(compiledResourceBytes[entryOffset+4:]))
		if entryOffset+headerSize+dataSize > len(compiledResourceBytes) {
			return nil, fmt.Errorf("entry at %d runs past the end of the file", entryOffset)
		}
		typeId, typeError := readOrdinal(compiledResourceBytes, entryOffset+8)
		if typeError != nil {
			return nil, fmt.Errorf("resource type at %d: %w", entryOffset, typeError)
		}
		nameId, nameError := readOrdinal(compiledResourceBytes, entryOffset+12)
		if nameError != nil {
			return nil, fmt.Errorf("resource name at %d: %w", entryOffset, nameError)
		}
		languageId := binary.LittleEndian.Uint16(compiledResourceBytes[entryOffset+16+6:])
		if dataSize > 0 {
			dataStart := entryOffset + headerSize
			resources = append(resources, resource{
				typeId:     typeId,
				nameId:     nameId,
				languageId: languageId,
				data:       compiledResourceBytes[dataStart : dataStart+dataSize],
			})
		}
		entryOffset = alignUp(entryOffset+headerSize+dataSize, resourceFileEntryAlignment)
	}
	sort.Slice(resources, func(i, j int) bool {
		if resources[i].typeId != resources[j].typeId {
			return resources[i].typeId < resources[j].typeId
		}
		if resources[i].nameId != resources[j].nameId {
			return resources[i].nameId < resources[j].nameId
		}
		return resources[i].languageId < resources[j].languageId
	})
	return resources, nil
}

// ponytail: only numeric resource types and names are read, which is all backend.rc uses; a named resource needs string directory entries added here.
func readOrdinal(compiledResourceBytes []byte, offset int) (uint16, error) {
	if binary.LittleEndian.Uint16(compiledResourceBytes[offset:]) != ordinalMarker {
		return 0, fmt.Errorf("named resources are not supported, use a number")
	}
	return binary.LittleEndian.Uint16(compiledResourceBytes[offset+2:]), nil
}

func buildResourceObject(resources []resource) []byte {
	typeIds := uniqueTypeIds(resources)
	nameIdsByType := map[uint16][]uint16{}
	for _, typeId := range typeIds {
		nameIdsByType[typeId] = uniqueNameIds(resources, typeId)
	}

	rootSize := directoryHeaderSize + directoryEntrySize*len(typeIds)
	typeDirectoryOffsets := map[uint16]int{}
	nameDirectoryOffsets := map[[2]uint16]int{}
	nextOffset := rootSize
	for _, typeId := range typeIds {
		typeDirectoryOffsets[typeId] = nextOffset
		nextOffset += directoryHeaderSize + directoryEntrySize*len(nameIdsByType[typeId])
	}
	for _, typeId := range typeIds {
		for _, nameId := range nameIdsByType[typeId] {
			nameDirectoryOffsets[[2]uint16{typeId, nameId}] = nextOffset
			nextOffset += directoryHeaderSize + directoryEntrySize*len(languagesOf(resources, typeId, nameId))
		}
	}
	dataEntriesOffset := nextOffset
	dataOffsets := make([]int, len(resources))
	nextOffset = alignUp(dataEntriesOffset+dataEntrySize*len(resources), resourceDataAlignment)
	for i, item := range resources {
		dataOffsets[i] = nextOffset
		nextOffset = alignUp(nextOffset+len(item.data), resourceDataAlignment)
	}

	section := make([]byte, nextOffset)
	writeDirectoryHeader(section, 0, len(typeIds))
	for i, typeId := range typeIds {
		writeDirectoryEntry(section, directoryHeaderSize+i*directoryEntrySize, typeId, typeDirectoryOffsets[typeId]|subdirectoryFlag)
	}
	for _, typeId := range typeIds {
		typeDirectoryOffset := typeDirectoryOffsets[typeId]
		writeDirectoryHeader(section, typeDirectoryOffset, len(nameIdsByType[typeId]))
		for i, nameId := range nameIdsByType[typeId] {
			writeDirectoryEntry(section, typeDirectoryOffset+directoryHeaderSize+i*directoryEntrySize, nameId, nameDirectoryOffsets[[2]uint16{typeId, nameId}]|subdirectoryFlag)
		}
	}
	var relocationOffsets []int
	for resourceIndex, item := range resources {
		nameDirectoryOffset := nameDirectoryOffsets[[2]uint16{item.typeId, item.nameId}]
		languageIds := languagesOf(resources, item.typeId, item.nameId)
		writeDirectoryHeader(section, nameDirectoryOffset, len(languageIds))
		for i, languageId := range languageIds {
			if languageId == item.languageId {
				dataEntryOffset := dataEntriesOffset + resourceIndex*dataEntrySize
				writeDirectoryEntry(section, nameDirectoryOffset+directoryHeaderSize+i*directoryEntrySize, languageId, dataEntryOffset)
				binary.LittleEndian.PutUint32(section[dataEntryOffset:], uint32(dataOffsets[resourceIndex]))
				binary.LittleEndian.PutUint32(section[dataEntryOffset+4:], uint32(len(item.data)))
				relocationOffsets = append(relocationOffsets, dataEntryOffset)
			}
		}
		copy(section[dataOffsets[resourceIndex]:], item.data)
	}

	var object bytes.Buffer
	sectionStart := fileHeaderSize + sectionHeaderSize
	relocationsStart := sectionStart + len(section)
	symbolTableStart := relocationsStart + relocationSize*len(relocationOffsets)
	binary.Write(&object, binary.LittleEndian, struct {
		Machine, NumberOfSections                            uint16
		TimeDateStamp, PointerToSymbolTable, NumberOfSymbols uint32
		SizeOfOptionalHeader, Characteristics                uint16
	}{machineAmd64, 1, 0, uint32(symbolTableStart), 1, 0, 0})
	binary.Write(&object, binary.LittleEndian, struct {
		Name                                                         [8]byte
		VirtualSize, VirtualAddress, SizeOfRawData, PointerToRawData uint32
		PointerToRelocations, PointerToLinenumbers                   uint32
		NumberOfRelocations, NumberOfLinenumbers                     uint16
		Characteristics                                              uint32
	}{[8]byte{'.', 'r', 's', 'r', 'c'}, 0, 0, uint32(len(section)), uint32(sectionStart), uint32(relocationsStart), 0, uint16(len(relocationOffsets)), 0, resourceSectionFlags})
	object.Write(section)
	for _, relocationOffset := range relocationOffsets {
		binary.Write(&object, binary.LittleEndian, struct {
			VirtualAddress, SymbolTableIndex uint32
			Type                             uint16
		}{uint32(relocationOffset), 0, relocationAmd64Addr32Nb})
	}
	binary.Write(&object, binary.LittleEndian, struct {
		Name                   [8]byte
		Value                  uint32
		SectionNumber          int16
		Type                   uint16
		StorageClass, AuxCount uint8
	}{[8]byte{'.', 'r', 's', 'r', 'c'}, 0, 1, 0, symbolClassStatic, 0})
	binary.Write(&object, binary.LittleEndian, uint32(4))
	return object.Bytes()
}

func writeDirectoryHeader(section []byte, offset int, idEntryCount int) {
	binary.LittleEndian.PutUint16(section[offset+14:], uint16(idEntryCount))
}

func writeDirectoryEntry(section []byte, offset int, id uint16, target int) {
	binary.LittleEndian.PutUint32(section[offset:], uint32(id))
	binary.LittleEndian.PutUint32(section[offset+4:], uint32(target))
}

func uniqueTypeIds(resources []resource) []uint16 {
	var typeIds []uint16
	for _, item := range resources {
		if len(typeIds) == 0 || typeIds[len(typeIds)-1] != item.typeId {
			typeIds = append(typeIds, item.typeId)
		}
	}
	return typeIds
}

func uniqueNameIds(resources []resource, typeId uint16) []uint16 {
	var nameIds []uint16
	for _, item := range resources {
		if item.typeId == typeId && (len(nameIds) == 0 || nameIds[len(nameIds)-1] != item.nameId) {
			nameIds = append(nameIds, item.nameId)
		}
	}
	return nameIds
}

func languagesOf(resources []resource, typeId uint16, nameId uint16) []uint16 {
	var languageIds []uint16
	for _, item := range resources {
		if item.typeId == typeId && item.nameId == nameId {
			languageIds = append(languageIds, item.languageId)
		}
	}
	return languageIds
}

func alignUp(value int, alignment int) int {
	return (value + alignment - 1) / alignment * alignment
}
