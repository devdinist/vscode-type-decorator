package com.example.sample;

import java.util.List;

/**
 * public class NotThis { } — 주석 안의 키워드는 무시된다.
 */
public final class OrderService {

    private static final String SQL = "select * from orders where kind = 'enum'";

    private final List<String> names;

    public OrderService(List<String> names) {
        this.names = names;
    }

    // git modified 상태를 만들기 위한 변경
    public int count() {
        return names.size();
    }

    pu

    private static class Cursor {
        int position;
    }
}
