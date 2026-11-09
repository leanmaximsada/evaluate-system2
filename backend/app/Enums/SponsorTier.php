<?php

namespace App\Enums;

enum SponsorTier: string
{
    case Diamond = 'diamond';
    case Gold = 'gold';
    case Silver = 'silver';
    case Supporter = 'supporter';

    /** Display order on the public screen. */
    public function rank(): int
    {
        return match ($this) {
            self::Diamond => 1,
            self::Gold => 2,
            self::Silver => 3,
            self::Supporter => 4,
        };
    }
}