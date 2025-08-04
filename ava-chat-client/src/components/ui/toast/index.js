export { default as Toaster } from "./Toaster.vue";
export { default as Toast } from "./Toast.vue";
export { default as ToastViewport } from "./ToastViewport.vue";
export { default as ToastAction } from "./ToastAction.vue";
export { default as ToastClose } from "./ToastClose.vue";
export { default as ToastTitle } from "./ToastTitle.vue";
export { default as ToastDescription } from "./ToastDescription.vue";
export { default as ToastProvider } from "./ToastProvider.vue";
export { toast, useToast } from "./use-toast";

import { cva } from "class-variance-authority";

const baseStyles = "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[--radix-toast-swipe-end-x] data-[swipe=move]:translate-x-[--radix-toast-swipe-move-x] data-[swipe=move]:transition-none";

const defaultAnimation = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full";

const bottomAnimation = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:toast-slide-out-to-screen-right data-[state=open]:slide-in-from-bottom-full";

export const toastVariants = cva(baseStyles, {
    variants: {
        variant: {
            default: `${defaultAnimation} border bg-background text-foreground`,
            success: `${defaultAnimation} group bg-green-500 text-white w-[90%] mx-auto`,
            destructive: `${defaultAnimation} group border-destructive bg-rose-500 w-[90%] mx-auto text-destructive-foreground`,
            warning: `${defaultAnimation} group border-destructive bg-amber-500 w-[90%] mx-auto text-destructive-foreground`,
            bottomOnly: `${bottomAnimation} border bg-background text-foreground`
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
