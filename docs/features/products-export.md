# Exporting products to Excel

**Added on 13 Nov 2026, for the next release.**

The client asked whether they can get an Excel file of their products and stock.

## How

1. Open **Products (Bidhaa)**.
2. Press **Export (Hamisha)**, next to **Import** and **Template**.
3. Save the file. It is named `products-<date>.xlsx`.

The button shows only for people who can add products, the same as Import, because the file includes buying prices.

## What's in the file

The columns match the import template:

| Column | What it holds |
| --- | --- |
| name | Product name. A variant is written as "Shirt · Large". |
| sku | SKU |
| barcode | The product's first single-item barcode |
| price, costPrice | Selling and buying price, as plain numbers |
| quantity, minStock | Stock and the low-stock level **in the shop you are working in** |
| wholesalePrice, wholesaleMin | Wholesale price and the minimum quantity for it |
| category, unit, piecesPerUnit | As set on the product |

- Every active product and variant is included. Archived products are left out.
- For stock across all shops, with values at cost and at selling price, use **Reports → Stock on hand → Excel**.

## Importing it back

The file uploads through **Import** as it is:

- to set up a **new company or shop** with the same products;
- to fix many prices in Excel before setting up.

Import only **adds** products. Uploading the file to the same company refuses every row, because each SKU already exists. To change prices on existing products, edit them in the app.

Also left out of the file:

- pack barcodes (for example a 24-pack code) and extra barcodes;
- add-ons, photos and preferred suppliers.

A variant comes back as its own product.

## For the team

- **API:** `GET /api/products/export` (`products:create`).
- **Code:**
  - `backend/internal/products/export.go` and `export_repository.go`;
  - `productsWorkbook` in `import.go`, shared with the template;
  - `frontend/app/composables/useProducts.ts` `exportProducts`.
- **Test:** `TestExportedProductsImportIntoAnotherCompany`.
