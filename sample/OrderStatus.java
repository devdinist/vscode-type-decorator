package com.example.sample;

public enum OrderStatus {
    PENDING,
    SHIPPED,
    DELIVERED;

    static final Class<?> TYPE = OrderStatus.class;
}
