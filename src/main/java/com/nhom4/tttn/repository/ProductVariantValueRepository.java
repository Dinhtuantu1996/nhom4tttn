package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.ProductVariantValue;
import com.nhom4.tttn.entity.ProductVariantValueId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ProductVariantValueRepository extends JpaRepository<ProductVariantValue, ProductVariantValueId> {
    @Query("""
            select link
            from ProductVariantValue link
            join fetch link.productVariant pv
            join fetch link.variant variant
            left join fetch variant.parent
            where pv.product.id = :productId
            order by pv.id asc, link.id.level asc
            """)
    List<ProductVariantValue> findAllByProductIdWithVariant(@Param("productId") Long productId);

    boolean existsByVariant_Id(Long variantId);

    @Query("""
            select link
            from ProductVariantValue link
            join fetch link.productVariant pv
            join fetch link.variant variant
            left join fetch variant.parent
            where pv.id in :productVariantIds
            order by pv.id asc, link.id.level asc
            """)
    List<ProductVariantValue> findAllByProductVariantIdsWithVariant(
            @Param("productVariantIds") Collection<Long> productVariantIds
    );

    @Modifying
    @Query("delete from ProductVariantValue link where link.productVariant.product.id = :productId")
    int deleteAllByProductId(@Param("productId") Long productId);
}
