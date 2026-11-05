<script setup lang="ts">
import {
  NConfigProvider,
  darkTheme,
  type GlobalThemeOverrides,
} from "naive-ui";
const theme: GlobalThemeOverrides = {
  common: {
    primaryColor: "#82adff",
    primaryColorHover: "#a4c4ff",
    primaryColorPressed: "#6596eb",
    bodyColor: "#151719",
    cardColor: "#1d2024",
    modalColor: "#202328",
    popoverColor: "#252930",
    borderColor: "#353a43",
    textColorBase: "#e8eaf0",
    textColor1: "#e8eaf0",
    textColor2: "#b1b7c2",
    fontFamily: "Inter, 'Segoe UI', 'Microsoft YaHei', sans-serif",
    fontSize: "12px",
    borderRadius: "5px",
  },
  Button: {
    heightSmall: "28px",
    fontSizeSmall: "12px",
    paddingSmall: "0 10px",
  },
};
</script>
<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="theme"
    ><slot
  /></NConfigProvider>
</template>
