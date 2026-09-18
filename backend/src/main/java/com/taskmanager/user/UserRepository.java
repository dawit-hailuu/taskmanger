package com.taskmanager.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * Federated lookup by the provider's immutable subject id. Preferred over
     * email, which a user can change at the provider without losing identity.
     */
    Optional<User> findByProviderId(String providerId);

    /**
     * Same lookup, scoped to one provider. {@link #findByProviderId} alone isn't
     * safe once more than one federated provider exists — {@code provider_id} is
     * only unique per {@code (auth_provider, provider_id)} pair (see the partial
     * index from V10), so two different providers' ids could otherwise collide.
     */
    Optional<User> findByAuthProviderAndProviderId(AuthProvider authProvider, String providerId);
}
