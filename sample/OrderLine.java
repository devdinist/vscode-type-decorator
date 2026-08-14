package com.example.sample;

import java.math.BigDecimal;

public record OrderLine(String sku, int quantity, BigDecimal price) {

    public BigDecimal total() {
        return price.multiply(BigDecimal.valueOf(quantity));
    }
}
