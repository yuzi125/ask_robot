<script setup>
import { isVNode, computed } from "vue";
import { useToast } from "./use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from ".";

const { toasts } = useToast();

const isAllBottomOnly = computed(() => {
  return toasts.value.every(toast => toast.variant === 'bottomOnly');
});
</script>

<template>
  <ToastProvider>
    <Toast v-for="toast in toasts" :key="toast.id" v-bind="toast">
      <div class="grid gap-1">
        <ToastTitle v-if="toast.title">
          {{ toast.title }}
        </ToastTitle>
        <template v-if="toast.description">
          <ToastDescription v-if="isVNode(toast.description)">
            <component :is="toast.description" />
          </ToastDescription>
          <ToastDescription v-else>
            {{ toast.description }}
          </ToastDescription>
        </template>
        <ToastClose />
      </div>
      <component :is="toast.action" />
    </Toast>
    <ToastViewport 
      :class="[
        isAllBottomOnly 
          ? 'fixed bottom-0 z-[100000] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:inset-x-0 sm:mx-auto sm:flex-col md:max-w-[420px]'
          : 'fixed top-0 z-[100000] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]'
      ]"
    />
  </ToastProvider>
</template>
