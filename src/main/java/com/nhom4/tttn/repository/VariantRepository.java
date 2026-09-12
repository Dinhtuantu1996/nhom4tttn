package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.Variant;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VariantRepository extends JpaRepository<Variant, Long> {
    @EntityGraph(attributePaths = "children")
    List<Variant> findByParentIsNullOrderByNameAsc();

    List<Variant> findAllByOrderByNameAsc();

    List<Variant> findByParent_IdOrderByNameAsc(Long parentId);

    boolean existsByParent_Id(Long parentId);

    boolean existsByNameIgnoreCaseAndParentIsNull(String name);

    boolean existsByNameIgnoreCaseAndParent_Id(String name, Long parentId);
}
