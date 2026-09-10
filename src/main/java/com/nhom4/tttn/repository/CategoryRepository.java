package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.Category;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    @EntityGraph(attributePaths = "children")
    List<Category> findByParentIsNullOrderByNameAsc();

    List<Category> findAllByOrderByNameAsc();
    boolean existsByParent_Id(Long parentId);
    boolean existsByNameIgnoreCaseAndParentIsNull(String name);
    boolean existsByNameIgnoreCaseAndParent_Id(String name, Long parentId);
}
