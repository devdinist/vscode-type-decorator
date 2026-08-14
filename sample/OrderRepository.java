package com.example.sample;

import java.util.Optional;

public interface OrderRepository {

    Optional<String> findById(long id);

    enum Sort {
        ASC, DESC
    }
}
