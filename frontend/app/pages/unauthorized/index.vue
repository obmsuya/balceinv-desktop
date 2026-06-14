<script setup lang="ts">
import { ShieldAlert } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const router = useRouter();

const goBack = () => {
  router.back();
};

const goHome = () => {
  router.push('/');
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <Card class="max-w-md w-full">
      <CardHeader class="text-center">
        <div class="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert class="h-8 w-8 text-destructive" />
        </div>
        <CardTitle class="text-2xl">Access Denied</CardTitle>
        <CardDescription>
          You do not have permission to access this page
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-muted-foreground text-center">
          This page is restricted to users with specific permissions. If you believe you should have access, please contact your administrator.
        </p>
        <div class="flex gap-2 justify-center">
          <Button variant="outline" @click="goBack">
            Go Back
          </Button>
          <Button @click="goHome">
            Go to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>