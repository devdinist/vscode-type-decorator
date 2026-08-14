<?php

namespace App\Sample;

interface OrderRepository
{
    public function findById(int $id): ?string;
}
