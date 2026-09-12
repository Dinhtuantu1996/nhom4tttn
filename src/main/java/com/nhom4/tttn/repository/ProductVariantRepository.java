package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.ProductVariant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {
    interface MinimumPriceRow {
        Long getProductId();
        BigDecimal getMinimumPrice();
    }

    List<ProductVariant> findAllByProduct_IdOrderByIdAsc(Long productId);

    @Query("select pv from ProductVariant pv join fetch pv.product where pv.id in :ids")
    List<ProductVariant> findAllByIdsWithProduct(@Param("ids") Collection<Long> ids);

    void deleteAllByProduct_Id(Long productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select pv from ProductVariant pv join fetch pv.product where pv.id = :id")
    Optional<ProductVariant> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select min(pv.price)
            from ProductVariant pv
            where pv.product.id = :productId and pv.quantity > 0
            """)
    BigDecimal findMinimumAvailablePrice(@Param("productId") Long productId);

    @Query("""
            select pv.product.id as productId, min(pv.price) as minimumPrice
            from ProductVariant pv
            where pv.product.id in :productIds and pv.quantity > 0
            group by pv.product.id
            """)
    List<MinimumPriceRow> findMinimumAvailablePrices(@Param("productIds") Collection<Long> productIds);
}
