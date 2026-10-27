<?php

namespace App\Enums;

enum EvaluationStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
}