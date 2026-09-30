package com.nhom4.tttn.service;

public record ImageChangeResult(
        int deleteRequested,
        int deleteSucceeded,
        int uploadRequested,
        int uploadSucceeded
) {
}
