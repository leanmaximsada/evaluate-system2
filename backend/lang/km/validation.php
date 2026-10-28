<?php

return [
    'required' => 'សូមបំពេញ :attribute។',
    'email' => ':attribute ត្រូវតែជាអាសយដ្ឋានអ៊ីមែលត្រឹមត្រូវ។',
    'unique' => ':attribute នេះមានគេប្រើរួចហើយ។',
    'confirmed' => 'ការបញ្ជាក់ :attribute មិនត្រូវគ្នាទេ។',
    'in' => ':attribute ដែលបានជ្រើសរើសមិនត្រឹមត្រូវទេ។',
    'numeric' => ':attribute ត្រូវតែជាលេខ។',
    'integer' => ':attribute ត្រូវតែជាចំនួនគត់។',
    'string' => ':attribute ត្រូវតែជាអក្សរ។',
    'array' => ':attribute ត្រូវតែជាបញ្ជី។',
    'boolean' => ':attribute ត្រូវតែជា ពិត ឬ មិនពិត។',
    'timezone' => ':attribute ត្រូវតែជាល្វែងម៉ោងត្រឹមត្រូវ។',
    'different' => ':attribute និង :other ត្រូវតែខុសគ្នា។',
    'gt' => [
        'numeric' => ':attribute ត្រូវតែធំជាង :value។',
    ],
    'min' => [
        'numeric' => ':attribute ត្រូវមានយ៉ាងតិច :min។',
        'string' => ':attribute ត្រូវមានយ៉ាងតិច :min តួអក្សរ។',
    ],
    'max' => [
        'numeric' => ':attribute មិនត្រូវលើស :max ទេ។',
        'string' => ':attribute មិនត្រូវលើស :max តួអក្សរទេ។',
    ],
    'between' => [
        'numeric' => ':attribute ត្រូវនៅចន្លោះ :min និង :max។',
    ],
    'password' => [
        'letters' => ':attribute ត្រូវមានអក្សរយ៉ាងតិចមួយ។',
        'mixed' => ':attribute ត្រូវមានអក្សរតូច និងអក្សរធំយ៉ាងតិចមួយ។',
        'numbers' => ':attribute ត្រូវមានលេខយ៉ាងតិចមួយ។',
    ],
    'attributes' => [
        'name' => 'ឈ្មោះ',
        'email' => 'អ៊ីមែល',
        'password' => 'ពាក្យសម្ងាត់',
        'current_password' => 'ពាក្យសម្ងាត់បច្ចុប្បន្ន',
        'role' => 'តួនាទី',
        'is_active' => 'ស្ថានភាព',
    ],
];