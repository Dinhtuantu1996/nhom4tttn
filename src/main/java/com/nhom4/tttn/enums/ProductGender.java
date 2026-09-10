package com.nhom4.tttn.enums;

public enum ProductGender {
    MALE("Nam"),
    FEMALE("Nu");

    private final String label;
    ProductGender(String label) { this.label = label; }
    public String getLabel() { return label; }
}
