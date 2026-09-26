package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.*;
import com.nhom4.tttn.entity.CustomerOrder;
import com.nhom4.tttn.entity.OrderItem;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.entity.User;
import com.nhom4.tttn.enums.OrderStatus;
import com.nhom4.tttn.repository.CustomerOrderRepository;
import com.nhom4.tttn.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
public class OrderService {
    private static final DateTimeFormatter CODE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CustomerOrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CartService cartService;

    @Transactional
    public CreateResult create(CreateOrderRequest request, User authenticatedUser) {
        CartValidationResponse cart = cartService.validate(request.items());
        if (cart.items().isEmpty()) {
            throw new IllegalArgumentException("Giỏ hàng không còn sản phẩm hợp lệ để đặt hàng.");
        }
        if (cart.changed() || !cart.checkoutAllowed()) {
            return new CreateResult(null, cart);
        }

        String customerName = normalizeRequired(request.customerName(), "Họ và tên", 120);
        String email = authenticatedUser == null
                ? normalizeEmail(request.customerEmail())
                : normalizeEmail(authenticatedUser.getEmail());
        String phone = normalizeRequired(request.phone(), "Số điện thoại", 30);
        String address = normalizeRequired(request.address(), "Địa chỉ", 1000);
        String note = normalizeOptional(request.note(), 2000);

        CustomerOrder order = new CustomerOrder();
        order.setCode(generateUniqueCode());
        order.setCustomerName(customerName);
        order.setCustomerEmail(email);
        order.setPhone(phone);
        order.setAddress(address);
        order.setNote(note);
        order.setStatus(OrderStatus.PENDING);
        order.setTotalAmount(cart.totalAmount());

        for (CartItemView cartItem : cart.items()) {
            OrderItem item = new OrderItem();
            item.setProduct(productRepository.getReferenceById(cartItem.productId()));
            item.setProductName(cartItem.productName());
            item.setUnitPrice(cartItem.unitPrice());
            item.setQuantity(cartItem.quantity());
            order.addItem(item);
        }

        return new CreateResult(orderRepository.save(order), null);
    }

    @Transactional(readOnly = true)
    public OrderDetailView lookup(String code, String email) {
        CustomerOrder order = orderRepository.findByCodeIgnoreCaseAndCustomerEmailIgnoreCase(normalizeCode(code), normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng với mã và email đã nhập."));
        return toDetailView(order);
    }

    @Transactional(readOnly = true)
    public CustomerOrder getDetailed(Long id) {
        return orderRepository.findDetailedById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng."));
    }

    @Transactional(readOnly = true)
    public Page<OrderSummaryView> searchAdmin(
            OrderStatus status,
            String keyword,
            int page,
            int size,
            String sort,
            String direction
    ) {
        return searchOrders(null, status, keyword, page, size, sort, direction);
    }

    @Transactional(readOnly = true)
    public Page<OrderSummaryView> searchMine(
            String email,
            OrderStatus status,
            String keyword,
            int page,
            int size,
            String sort,
            String direction
    ) {
        return searchOrders(normalizeEmail(email), status, keyword, page, size, sort, direction);
    }

    private Page<OrderSummaryView> searchOrders(
            String customerEmail,
            OrderStatus status,
            String keyword,
            int page,
            int size,
            String sort,
            String direction
    ) {
        String safeSort = normalizeOrderSort(sort);
        String safeDirection = normalizeSortDirection(direction);
        Sort.Direction sortDirection = "asc".equals(safeDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        String property = switch (safeSort) {
            case "code" -> "code";
            case "customer" -> "customerName";
            case "contact" -> "phone";
            case "total" -> "totalAmount";
            case "status" -> "status";
            default -> "createdDate";
        };

        Sort orderSort = Sort.by(sortDirection, property)
                .and(Sort.by(Sort.Direction.DESC, "id"));

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 10), 100),
                orderSort
        );

        Specification<CustomerOrder> spec = Specification.unrestricted();
        if (customerEmail != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(cb.lower(root.get("customerEmail")), customerEmail));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (keyword != null && !keyword.isBlank()) {
            String value = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("code")), value),
                    cb.like(cb.lower(root.get("customerName")), value),
                    cb.like(cb.lower(root.get("customerEmail")), value),
                    cb.like(cb.lower(root.get("phone")), value)
            ));
        }
        return orderRepository.findAll(spec, pageable).map(this::toSummaryView);
    }

    public static String normalizeOrderSort(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "code", "customer", "contact", "total", "status", "created" -> normalized;
            default -> "created";
        };
    }

    public static String normalizeSortDirection(String value) {
        return value != null && value.trim().equalsIgnoreCase("asc") ? "asc" : "desc";
    }

    @Transactional(readOnly = true)
    public OrderReview review(Long id) {
        return buildReview(getDetailed(id), true);
    }

    @Transactional(readOnly = true)
    public OrderReview reviewMine(String email, String code) {
        CustomerOrder order = orderRepository
                .findByCodeIgnoreCaseAndCustomerEmailIgnoreCase(normalizeCode(code), normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng phù hợp."));
        return buildReview(order, false);
    }

    private OrderReview buildReview(CustomerOrder order, boolean includeStockReview) {
        List<OrderItemReview> reviews = new ArrayList<>();

        if (!includeStockReview) {
            for (OrderItem item : order.getItems()) {
                reviews.add(new OrderItemReview(
                        toLineView(item),
                        null,
                        true,
                        List.of()
                ));
            }
            return new OrderReview(toDetailView(order), List.copyOf(reviews));
        }

        Map<Long, Long> requestedByProduct = new TreeMap<>();
        for (OrderItem item : order.getItems()) {
            if (item.getProductId() != null && item.getQuantity() > 0) {
                requestedByProduct.merge(item.getProductId(), (long) item.getQuantity(), Long::sum);
            }
        }

        for (OrderItem item : order.getItems()) {
            List<String> warnings = new ArrayList<>();
            Integer available = null;
            boolean stockSufficient = true;

            Product product = item.getProductId() == null
                    ? null
                    : productRepository.findById(item.getProductId()).orElse(null);
            if (product != null) {
                available = Math.max(product.getQuantity(), 0);
            }

            if (order.getStatus() == OrderStatus.PENDING) {
                if (product == null) {
                    stockSufficient = false;
                    warnings.add("Sản phẩm gốc không còn tồn tại. Không thể hoàn thành đơn.");
                } else if (item.getQuantity() <= 0) {
                    stockSufficient = false;
                    warnings.add("Số lượng trên hóa đơn không hợp lệ. Không thể hoàn thành đơn.");
                } else {
                    long required = requestedByProduct.getOrDefault(item.getProductId(), (long) item.getQuantity());
                    if (available < required) {
                        stockSufficient = false;
                        warnings.add("Kho hiện chỉ còn " + available + " nhưng hóa đơn cần " + required
                                + ". Hãy bổ sung tồn kho hoặc hủy đơn.");
                    }
                }
            }

            reviews.add(new OrderItemReview(
                    toLineView(item),
                    available,
                    stockSufficient,
                    List.copyOf(warnings)
            ));
        }
        return new OrderReview(toDetailView(order), List.copyOf(reviews));
    }

    @Transactional
    public String complete(Long orderId) {
        CustomerOrder order = lockOrder(orderId);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new IllegalStateException("Chỉ đơn đang chờ xác nhận mới được hoàn thành.");
        }

        Map<Long, StockRequirement> requirements = buildStockRequirements(order);
        Map<Long, Product> lockedProducts = new LinkedHashMap<>();
        for (Map.Entry<Long, StockRequirement> entry : requirements.entrySet()) {
            Long productId = entry.getKey();
            StockRequirement requirement = entry.getValue();
            Product product = productRepository.findByIdForUpdate(productId)
                    .orElseThrow(() -> new IllegalStateException(
                            "Sản phẩm \"" + requirement.productName() + "\" không còn tồn tại. Không thể hoàn thành đơn."
                    ));

            int available = Math.max(product.getQuantity(), 0);
            if (available < requirement.quantity()) {
                throw new IllegalStateException(
                        "Không đủ tồn kho cho \"" + requirement.productName() + "\". Kho hiện còn " + available
                                + ", hóa đơn cần " + requirement.quantity()
                                + ". Hãy bổ sung tồn kho hoặc hủy đơn."
                );
            }
            lockedProducts.put(productId, product);
        }
        for (Map.Entry<Long, StockRequirement> entry : requirements.entrySet()) {
            Product product = lockedProducts.get(entry.getKey());
            product.setQuantity(product.getQuantity() - entry.getValue().quantity());
            productRepository.save(product);
        }

        order.setStatus(OrderStatus.COMPLETED);
        order.setCompletedDate(LocalDateTime.now());
        orderRepository.save(order);
        return "Đã hoàn thành đơn và trừ tồn kho thành công.";
    }

    @Transactional
    public String cancel(Long orderId) {
        CustomerOrder order = lockOrder(orderId);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new IllegalStateException("Chỉ đơn đang chờ xác nhận mới được hủy.");
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelledDate(LocalDateTime.now());
        orderRepository.save(order);
        return "Đã hủy đơn hàng.";
    }

    private Map<Long, StockRequirement> buildStockRequirements(CustomerOrder order) {
        Map<Long, StockRequirement> requirements = new TreeMap<>();

        for (OrderItem item : order.getItems()) {
            if (item.getProductId() == null) {
                throw new IllegalStateException("Hóa đơn có sản phẩm thiếu mã sản phẩm gốc. Không thể hoàn thành đơn.");
            }
            if (item.getQuantity() <= 0) {
                throw new IllegalStateException("Hóa đơn có số lượng sản phẩm không hợp lệ. Không thể hoàn thành đơn.");
            }

            StockRequirement previous = requirements.get(item.getProductId());
            long totalQuantity = item.getQuantity();
            if (previous != null) {
                totalQuantity += previous.quantity();
            }
            if (totalQuantity > Integer.MAX_VALUE) {
                throw new IllegalStateException("Số lượng sản phẩm trên hóa đơn vượt giới hạn cho phép.");
            }

            requirements.put(
                    item.getProductId(),
                    new StockRequirement(
                            previous == null ? item.getProductName() : previous.productName(),
                            (int) totalQuantity
                    )
            );
        }

        if (requirements.isEmpty()) {
            throw new IllegalStateException("Hóa đơn không có sản phẩm để hoàn thành.");
        }
        return requirements;
    }

    private CustomerOrder lockOrder(Long id) {
        return orderRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng."));
    }

    private OrderSummaryView toSummaryView(CustomerOrder order) {
        return new OrderSummaryView(
                order.getId(),
                order.getCode(),
                order.getCustomerName(),
                order.getCustomerEmail(),
                order.getPhone(),
                order.getStatus(),
                order.getTotalAmount(),
                order.getCreatedDate()
        );
    }

    private OrderDetailView toDetailView(CustomerOrder order) {
        List<OrderLineView> items = order.getItems().stream()
                .map(this::toLineView)
                .toList();
        return new OrderDetailView(
                order.getId(),
                order.getCode(),
                order.getCustomerName(),
                order.getCustomerEmail(),
                order.getPhone(),
                order.getAddress(),
                order.getNote(),
                order.getStatus(),
                order.getTotalAmount(),
                order.getCreatedDate(),
                order.getUpdatedDate(),
                order.getCompletedDate(),
                order.getCancelledDate(),
                items
        );
    }

    private OrderLineView toLineView(OrderItem item) {
        return new OrderLineView(
                item.getProductId(),
                item.getProductName(),
                item.getUnitPrice(),
                item.getQuantity()
        );
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder suffix = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                suffix.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String code = "GN-" + LocalDateTime.now().format(CODE_DATE) + "-" + suffix;
            if (!orderRepository.existsByCodeIgnoreCase(code)) return code;
        }
        throw new IllegalStateException("Không thể tạo mã đơn hàng. Vui lòng thử lại.");
    }

    private String normalizeEmail(String email) {
        String value = normalizeRequired(email, "Email", 180).toLowerCase(Locale.ROOT);
        if (!value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new IllegalArgumentException("Email không hợp lệ.");
        }
        return value;
    }

    private String normalizeCode(String code) {
        return normalizeRequired(code, "Mã đơn hàng", 40).toUpperCase(Locale.ROOT);
    }

    private String normalizeRequired(String value, String label, int maxLength) {
        String normalized = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (normalized.isBlank()) throw new IllegalArgumentException(label + " là bắt buộc.");
        if (normalized.length() > maxLength) throw new IllegalArgumentException(label + " quá dài.");
        return normalized;
    }

    private String normalizeOptional(String value, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() > maxLength) throw new IllegalArgumentException("Ghi chú quá dài.");
        return normalized.isBlank() ? null : normalized;
    }

    private record StockRequirement(String productName, int quantity) {
    }

    public record CreateResult(CustomerOrder order, CartValidationResponse cartChanged) {
        public boolean created() {
            return order != null;
        }
    }
}
