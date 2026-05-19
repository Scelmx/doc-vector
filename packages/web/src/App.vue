<template>
  <div class="min-h-screen bg-background bg-tech-gradient">
    <div class="bg-hero-glow min-h-screen">
      <AppHeader />
      <main class="container mx-auto px-6 py-8 max-w-7xl">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
</script>
