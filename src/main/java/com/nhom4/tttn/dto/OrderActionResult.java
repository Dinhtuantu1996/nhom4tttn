package com.nhom4.tttn.dto;

import java.util.List;

public record OrderActionResult(
        String message,
        List<String> warnings
) {
    public boolean hasWarnings() {
        return warnings != null && !warnings.isEmpty();
    }
}
