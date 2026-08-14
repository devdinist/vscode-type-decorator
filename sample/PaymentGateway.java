package com.example.sample;

import java.math.BigDecimal;

public interface PaymentGateway {

    void charge(String token, BigDecimal amount);
}
