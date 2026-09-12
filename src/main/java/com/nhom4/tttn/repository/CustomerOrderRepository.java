package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.CustomerOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long>, JpaSpecificationExecutor<CustomerOrder> {
    boolean existsByCodeIgnoreCase(String code);

    List<CustomerOrder> findByCustomerEmailIgnoreCaseOrderByCreatedDateDesc(String customerEmail);

    @EntityGraph(attributePaths = "items")
    Optional<CustomerOrder> findDetailedById(Long id);

    @EntityGraph(attributePaths = "items")
    Optional<CustomerOrder> findByCodeIgnoreCaseAndCustomerEmailIgnoreCase(String code, String customerEmail);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.id = :id")
    Optional<CustomerOrder> findByIdForUpdate(@Param("id") Long id);
}
