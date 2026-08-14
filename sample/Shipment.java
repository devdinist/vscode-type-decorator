package com.example.sample;

import java.time.Instant;

public record Shipment(String trackingNumber, Instant shippedAt) {
}
