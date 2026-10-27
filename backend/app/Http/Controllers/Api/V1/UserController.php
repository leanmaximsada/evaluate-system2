<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Users\ListUsersRequest;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Http\Requests\Users\UpdateUserStatusRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    public function __construct(private readonly UserService $users) {}

    public function index(ListUsersRequest $request): AnonymousResourceCollection
    {
        $query = User::query()
            ->when($request->validated('search'), function (Builder $q, string $term) {
                // Escape LIKE wildcards so "%" and "_" are matched literally.
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn (Builder $q) => $q->where('name', 'ilike', $like)->orWhere('email', 'ilike', $like));
            })
            ->when($request->validated('role'), fn (Builder $q, string $role) => $q->where('role', $role))
            ->when($request->validated('status'), fn (Builder $q, string $status) => $q->where('is_active', $status === 'active'))
            ->orderBy($request->validated('sort') ?? 'created_at', $request->validated('direction') ?? 'desc')
            ->orderBy('id');

        return UserResource::collection(
            $query->paginate($request->validated('per_page') ?? 15)->withQueryString()
        );
    }

    public function show(User $user): UserResource
    {
        Gate::authorize('view', $user);

        return UserResource::make($user);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->users->create($request->validated(), $request->user());

        return UserResource::make($user)->response()->setStatusCode(201);
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        return UserResource::make($this->users->update($user, $request->validated(), $request->user()));
    }

    public function updateStatus(UpdateUserStatusRequest $request, User $user): UserResource
    {
        return UserResource::make($this->users->setStatus($user, $request->boolean('is_active'), $request->user()));
    }

    public function sendPasswordReset(Request $request, User $user): JsonResponse
    {
        Gate::authorize('update', $user);

        $this->users->sendPasswordReset($user, $request->user());

        return response()->json(['message' => 'Password reset link sent.']);
    }
}