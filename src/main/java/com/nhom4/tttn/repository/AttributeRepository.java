package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.Attribute;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttributeRepository extends JpaRepository<Attribute, Long> {
    @EntityGraph(attributePaths = "children")
    List<Attribute> findByParentIsNullOrderByNameAsc();

    List<Attribute> findAllByOrderByNameAsc();

    boolean existsByParent_Id(Long parentId);

    boolean existsByNameIgnoreCaseAndParentIsNull(String name);

    boolean existsByNameIgnoreCaseAndParent_Id(String name, Long parentId);
}
