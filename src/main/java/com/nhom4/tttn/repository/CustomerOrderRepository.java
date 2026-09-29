package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.CustomerOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long>, JpaSpecificationExecutor<CustomerOrder> {
    boolean existsByCodeIgnoreCase(String code);

    @EntityGraph(attributePaths = "items")
    Optional<CustomerOrder> findDetailedById(Long id);

    @EntityGraph(attributePaths = "items")
    Optional<CustomerOrder> findByCodeIgnoreCaseAndCustomerEmailIgnoreCase(String code, String customerEmail);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.id = :id")
    Optional<CustomerOrder> findByIdForUpdate(@Param("id") Long id);
}
