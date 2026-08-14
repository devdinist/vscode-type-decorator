<?php

namespace App\Sample;

use Psr\Log\NullLogger;

#[Deprecated]
final class OrderService
{
    private const SQL = <<<SQL
        select * from orders
        -- class FakeOne { } 에 속으면 안 된다
        SQL;

    # class FakeTwo { }
    private string $note = 'interface FakeThree { }';

    public function makeLogger(): object
    {
        return new class extends NullLogger {
        };
    }
}
