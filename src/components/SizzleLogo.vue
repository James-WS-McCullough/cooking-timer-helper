<template>
  <!-- The dial from the app icon, minus its background tile. -->
  <svg viewBox="56 56 400 400" aria-hidden="true">
    <!-- Wedge first: the ring is drawn over it, so the fill can't spill onto the outline. -->
    <path d="M256 272 L256 122 A150 150 0 0 1 385.9 347 Z" fill="var(--accent)" />
    <circle cx="256" cy="272" r="150" fill="none" stroke="currentColor" stroke-width="28" />
    <rect x="226" y="68" width="60" height="34" rx="10" fill="currentColor" />
    <circle cx="256" cy="272" r="16" fill="currentColor" />
  </svg>
</template>
