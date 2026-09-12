package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.*;
import com.nhom4.tttn.entity.CustomerOrder;
import com.nhom4.tttn.entity.OrderItem;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.entity.ProductVariant;
import com.nhom4.tttn.entity.User;
import com.nhom4.tttn.enums.OrderStatus;
import com.nhom4.tttn.repository.CustomerOrderRepository;
import com.nhom4.tttn.repository.ProductRepository;
import com.nhom4.tttn.repository.ProductVariantRepository;
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
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class OrderService {
    private static final DateTimeFormatter CODE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CustomerOrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
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
        order.setUserId(authenticatedUser == null ? null : authenticatedUser.getId());
        order.setCustomerName(customerName);
        order.setCustomerEmail(email);
        order.setPhone(phone);
        order.setAddress(address);
        order.setNote(note);
        order.setStatus(OrderStatus.PENDING);
        order.setTotalAmount(cart.totalAmount());

        for (CartItemView cartItem : cart.items()) {
            OrderItem item = new OrderItem();
            item.setProductId(cartItem.productId());
            item.setProductVariantId(cartItem.productVariantId());
            item.setProductName(cartItem.productName());
            item.setVariantName(cartItem.variantName());
            item.setUnitPrice(cartItem.unitPrice());
            item.setQuantity(cartItem.quantity());
            item.setLineTotal(cartItem.lineTotal());
            item.setStockDeductedQuantity(0);
            order.addItem(item);
        }

        return new CreateResult(orderRepository.save(order), null);
    }

    @Transactional(readOnly = true)
    public List<OrderSummaryView> findMine(String email) {
        return orderRepository.findByCustomerEmailIgnoreCaseOrderByCreatedDateDesc(normalizeEmail(email)).stream()
                .map(this::toSummaryView)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderDetailView findMineByCode(String email, String code) {
        CustomerOrder order = orderRepository.findByCodeIgnoreCaseAndCustomerEmailIgnoreCase(normalizeCode(code), normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng phù hợp."));
        return toDetailView(order);
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
    public Page<OrderSummaryView> searchAdmin(OrderStatus status, String keyword, int page, int size) {
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 10), 100),
                Sort.by(Sort.Direction.DESC, "createdDate").and(Sort.by(Sort.Direction.DESC, "id"))
        );

        Specification<CustomerOrder> spec = Specification.unrestricted();
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

    @Transactional(readOnly = true)
    public OrderReview review(Long id) {
        CustomerOrder order = getDetailed(id);
        List<OrderItemReview> reviews = new ArrayList<>();

        for (OrderItem item : order.getItems()) {
            List<String> warnings = new ArrayList<>();
            Integer available = null;

            Product product = item.getProductId() == null
                    ? null
                    : productRepository.findById(item.getProductId()).orElse(null);
            if (product == null) {
                warnings.add("Sản phẩm gốc không còn tồn tại trong hệ thống.");
            }

            if (item.getProductVariantId() != null) {
                ProductVariant variant = productVariantRepository.findById(item.getProductVariantId()).orElse(null);
                if (variant == null || variant.getProduct() == null
                        || item.getProductId() == null
                        || !item.getProductId().equals(variant.getProduct().getId())) {
                    warnings.add("Biến thể gốc không còn tồn tại hoặc không còn thuộc sản phẩm này.");
                } else {
                    available = variant.getQuantity();
                }
            } else if (product != null) {
                if (product.getVariantType() != 0) {
                    warnings.add("Sản phẩm hiện đã chuyển sang quản lý tồn kho theo biến thể.");
                } else {
                    available = product.getQuantity();
                }
            }

            if (order.getStatus() == OrderStatus.PENDING && available != null && available < item.getQuantity()) {
                warnings.add("Kho hiện chỉ còn " + available + " nhưng đơn cần " + item.getQuantity() + ". ADMIN vẫn có thể xác nhận.");
            }

            reviews.add(new OrderItemReview(toLineView(item), available, List.copyOf(warnings)));
        }
        return new OrderReview(toDetailView(order), List.copyOf(reviews));
    }

    @Transactional
    public OrderActionResult complete(Long orderId) {
        CustomerOrder order = lockOrder(orderId);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new IllegalStateException("Chỉ đơn đang chờ ADMIN duyệt mới được chốt hoàn thành.");
        }

        List<String> warnings = new ArrayList<>();
        for (OrderItem item : stockOrderedItems(order)) {
            int deducted = deductStock(item, warnings);
            item.setStockDeductedQuantity(deducted);
        }

        order.setStatus(OrderStatus.COMPLETED);
        order.setCompletedDate(LocalDateTime.now());
        orderRepository.save(order);
        return new OrderActionResult(
                "Đã chốt đơn hoàn thành và đồng bộ tồn kho.",
                List.copyOf(warnings)
        );
    }

    @Transactional
    public OrderActionResult cancel(Long orderId) {
        CustomerOrder order = lockOrder(orderId);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new IllegalStateException("Chỉ đơn đang chờ ADMIN duyệt mới được hủy.");
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelledDate(LocalDateTime.now());
        orderRepository.save(order);
        return new OrderActionResult("Đã hủy đơn hàng.", List.of());
    }

    private List<OrderItem> stockOrderedItems(CustomerOrder order) {
        List<OrderItem> items = new ArrayList<>(order.getItems());
        items.sort((left, right) -> {
            int leftType = left.getProductVariantId() == null ? 0 : 1;
            int rightType = right.getProductVariantId() == null ? 0 : 1;
            int typeCompare = Integer.compare(leftType, rightType);
            if (typeCompare != 0) return typeCompare;
            Long leftId = leftType == 0 ? left.getProductId() : left.getProductVariantId();
            Long rightId = rightType == 0 ? right.getProductId() : right.getProductVariantId();
            if (leftId == null) return rightId == null ? 0 : 1;
            if (rightId == null) return -1;
            return Long.compare(leftId, rightId);
        });
        return items;
    }

    private int deductStock(OrderItem item, List<String> warnings) {
        int requested = Math.max(item.getQuantity(), 0);
        if (requested == 0) return 0;

        if (item.getProductVariantId() != null) {
            ProductVariant variant = productVariantRepository.findByIdForUpdate(item.getProductVariantId()).orElse(null);
            if (variant == null || variant.getProduct() == null || item.getProductId() == null
                    || !item.getProductId().equals(variant.getProduct().getId())) {
                warnings.add(item.getProductName() + ": không tìm thấy biến thể hiện tại, không trừ tồn kho.");
                return 0;
            }
            int available = Math.max(variant.getQuantity(), 0);
            int deducted = Math.min(available, requested);
            variant.setQuantity(available - deducted);
            productVariantRepository.save(variant);
            if (deducted < requested) {
                warnings.add(item.getProductName() + variantSuffix(item) + ": cần " + requested
                        + ", kho chỉ có " + available + ". Đã trừ " + deducted + " và vẫn xác nhận đơn theo quyết định ADMIN.");
            }
            return deducted;
        }

        if (item.getProductId() == null) {
            warnings.add(item.getProductName() + ": thiếu mã sản phẩm gốc, không trừ tồn kho.");
            return 0;
        }
        Product product = productRepository.findByIdForUpdate(item.getProductId()).orElse(null);
        if (product == null) {
            warnings.add(item.getProductName() + ": sản phẩm gốc không còn tồn tại, không trừ tồn kho.");
            return 0;
        }
        if (product.getVariantType() != 0) {
            warnings.add(item.getProductName() + ": sản phẩm hiện đã chuyển sang biến thể, không thể trừ tồn kho cũ tự động.");
            return 0;
        }
        int available = Math.max(product.getQuantity(), 0);
        int deducted = Math.min(available, requested);
        product.setQuantity(available - deducted);
        productRepository.save(product);
        if (deducted < requested) {
            warnings.add(item.getProductName() + ": cần " + requested + ", kho chỉ có " + available
                    + ". Đã trừ " + deducted + " và vẫn xác nhận đơn theo quyết định ADMIN.");
        }
        return deducted;
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
                order.getUserId(),
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
                item.getProductVariantId(),
                item.getProductName(),
                item.getVariantName(),
                item.getUnitPrice(),
                item.getQuantity(),
                item.getLineTotal(),
                item.getStockDeductedQuantity()
        );
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder suffix = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                suffix.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String code = "N4-" + LocalDateTime.now().format(CODE_DATE) + "-" + suffix;
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

    private String variantSuffix(OrderItem item) {
        return item.getVariantName() == null || item.getVariantName().isBlank() ? "" : " (" + item.getVariantName() + ")";
    }

    public record CreateResult(CustomerOrder order, CartValidationResponse cartChanged) {
        public boolean created() {
            return order != null;
        }
    }
}
