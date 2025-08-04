<script setup>
import { ref, onMounted, onUnmounted } from "vue";
const props = defineProps({
    location: { type: String, default: "top" },
    disabled: { type: Boolean, default: false },
    maxWidth: { type: String, default: "none" },
});

const childNodeRef = ref(null);
let parentDiv;
let rect = {};
onMounted(() => {
    parentDiv = childNodeRef.value.parentNode;
    startEventListener(parentDiv);
});
onUnmounted(() => {
    endEventListener(parentDiv);
});

function startEventListener(parentDiv) {
    parentDiv?.addEventListener("mouseenter", handleMouseenter);
    parentDiv?.addEventListener("mouseleave", handleMouseleave);
    document?.addEventListener("wheel", throttle(handleWheel, 200));
}
function endEventListener(parentDiv) {
    parentDiv?.removeEventListener("mouseenter", handleMouseenter);
    parentDiv?.removeEventListener("mouseleave", handleMouseleave);
    document?.removeEventListener("wheel", throttle(handleWheel, 200));
}

function handleMouseenter(e) {
    createTooltip(e);
}
function handleMouseleave() {
    deleteTooltip();
}

function handleWheel(e) {
    let thisRect = e.target.getBoundingClientRect();
    if (rect.top) {
        if (rect.top !== thisRect.top || rect.left !== thisRect.left) {
            deleteTooltip();
        }
    }
}
function throttle(fn, time = 50) {
    let canRun = true;
    return function (...args) {
        if (!canRun) return;
        canRun = false;
        setTimeout(() => {
            fn.apply(this, args);
            canRun = true;
        }, time);
    };
}

let tooltip;
function createTooltip(e) {
    if (props.disabled || !childNodeRef.value.textContent) return;
    rect = e.target.getBoundingClientRect();
    tooltip = document.createElement("div");
    let location = getLocation();
    // console.log(location);
    let style = {
        position: "fixed",
        padding: "0.5rem",
        "border-radius": "0.3rem",
        "background-color": "#333333",
        color: "white",
        transition: "0.3s all",
        opacity: "0",
        top: location.top,
        left: location.left,
        transform: location.transform,
        "pointer-events": "none",
        "max-width": props.maxWidth,
        "word-wrap": "break-word",
        "word-break": "break-all",
    };
    style = Object.keys(style)
        .map((key) => `${key}:${style[key]};`)
        .join(" ");
    tooltip.textContent = childNodeRef.value.textContent;
    tooltip.style = style;
    document.body.appendChild(tooltip);
    chkScope();
    setTimeout(() => {
        tooltip.style.opacity = "1";
    }, 10);
}
function deleteTooltip() {
    if (document.body.contains(tooltip)) {
        rect = {};
        document.body.removeChild(tooltip);
    }
}

function getLocation() {
    let top, left, transform;
    switch (props.location) {
        case "top":
            top = `${parseInt(rect["top"] - 8)}px`;
            left = `${parseInt(rect["left"] + parseInt(parentDiv.clientWidth / 2))}px`;
            transform = `translate(-50%,-100%)`;
            break;
        case "bottom":
            top = `${parseInt(rect["bottom"])}px`;
            left = `${parseInt(rect["left"] + parseInt(parentDiv.clientWidth / 2))}px`;
            transform = `translate(-50%,8px)`;
            break;
        case "left":
            top = `${parseInt(rect["top"]) + parseInt(parentDiv.clientHeight / 2)}px`;
            left = `${parseInt(rect["left"] - 8)}px`;
            transform = `translate(-100%,-50%)`;
            break;
        case "right":
            top = `${parseInt(rect["top"]) + parseInt(parentDiv.clientHeight / 2)}px`;
            left = `${parseInt(rect["right"])}px`;
            transform = `translate(8px,-50%)`;
            break;
    }
    return { top, left, transform };
}
function chkScope() {
    let leastScopeY = tooltip.clientHeight + 8;
    let leastScopeX = tooltip.clientWidth + 8;
    switch (props.location) {
        case "top":
            if (rect.top < leastScopeY) {
                tooltip.style.top = `${leastScopeY}px`;
            }
            break;
        case "bottom":
            if (rect.bottom < leastScopeY) {
                tooltip.style.bottom = `${leastScopeY}px`;
            }
            break;
        case "left":
            if (rect.left < leastScopeX) {
                tooltip.style.left = `${leastScopeX}px`;
            }
            break;
        case "right":
            if (rect.right < leastScopeX) {
                tooltip.style.right = `${leastScopeX}px`;
            }
            break;
    }
}
</script>

<!-- <div ref="tooltip" class="" v-show="isOpen" :style="style"> -->
<template>
    <div ref="childNodeRef" v-show="false">
        <slot></slot>
    </div>
</template>

<style lang="scss" scoped>
.a {
    visibility: visible;
}
</style>
