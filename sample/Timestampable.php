<?php

namespace App\Sample;

trait Timestampable
{
    private ?\DateTimeImmutable $createdAt = null;

    public function touch(): void
    {
        $this->createdAt = new \DateTimeImmutable();
    }
}
