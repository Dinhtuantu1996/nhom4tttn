package com.nhom4.tttn.enums;

public enum ProductAgeGroup {
    CHILD("Tre em"),
    ADULT("Nguoi lon");

    private final String label;
    ProductAgeGroup(String label) { this.label = label; }
    public String getLabel() { return label; }
}
