import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Image,
  Loader2,
  Package,
  Search,
  RefreshCw,
  RotateCcw,
  Truck,
  CircleDot
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const ORDER_ACTIONS = [
  { action: "ORDER_CONFIRM", label: "Confirm", tone: "bg-sky-100 text-sky-700" },
  { action: "ORDER_PACK", label: "Pack", tone: "bg-amber-100 text-amber-700" },
  { action: "ORDER_SHIP", label: "Ship", tone: "bg-indigo-100 text-indigo-700" },
  { action: "ORDER_FULFILL", label: "Fulfill", tone: "bg-emerald-100 text-emerald-700" },
  { action: "ORDER_DELIVER", label: "Deliver", tone: "bg-emerald-100 text-emerald-700" },
  { action: "ORDER_CANCEL", label: "Cancel", tone: "bg-rose-100 text-rose-700" }
];

const RETURN_ACTIONS = [
  { action: "RETURN_APPROVE", label: "Approve", tone: "bg-emerald-100 text-emerald-700" },
  { action: "RETURN_REJECT", label: "Reject", tone: "bg-rose-100 text-rose-700" },
  { action: "RETURN_RECEIVE", label: "Receive", tone: "bg-amber-100 text-amber-700" }
];

const REFUND_ACTIONS = [
  { action: "REFUND_APPROVE", label: "Approve", tone: "bg-emerald-100 text-emerald-700" },
  { action: "REFUND_REJECT", label: "Reject", tone: "bg-rose-100 text-rose-700" },
  { action: "REFUND_ISSUE", label: "Issue", tone: "bg-indigo-100 text-indigo-700" }
];

const TAB_ICON_MAP = {
  ClipboardList,
  RotateCcw,
  DollarSign,
  CreditCard
};

const TRACK_ICON_MAP = {
  Bell,
  FileText,
  Package,
  Truck,
  Check,
  CircleDot
};

const DEFAULT_LAYOUT = {
  header: {
    eyebrow: "Commerce",
    title: "Orders & payments",
    subtitle: "Track sales orders, returns, and refunds flowing through the core process engine."
  },
  tabs: [
    { id: "orders", label: "Orders", icon: "ClipboardList" },
    { id: "returns", label: "Returns", icon: "RotateCcw" },
    { id: "refunds", label: "Refunds", icon: "DollarSign" },
    { id: "payments", label: "Payments", icon: "CreditCard" }
  ],
  list: {
    title: "Queue",
    searchPlaceholder: "Search orders, buyers, items...",
    perPageLabel: "Per page",
    perPageOptions: [12, 25, 50],
    refreshLabel: "Refresh",
    empty: "Nothing here yet.",
    emptyFiltered: "No orders match the current search.",
    pageLabel: "Page",
    pageOfLabel: "of",
    prevLabel: "Prev",
    nextLabel: "Next",
    ellipsisLabel: "...",
    codeFallback: "ORDER",
    itemFallback: "Order",
    buyerFallback: "Buyer",
    stageFallback: "new",
    orderLabel: "Order",
    untitledFallback: "Untitled"
  },
  detail: {
    title: "Order details",
    orderNumberLabel: "Order no.",
    orderCodeLabel: "Code",
    untitledOrder: "Sales order",
    untitledItem: "Order item",
    invoiceLabel: "Invoice",
    contactLabel: "Contact us",
    statusLabel: "Order status",
    trackTitle: "Track order",
    orderPaymentTitle: "Payment details",
    paymentMethodLabel: "Payment method",
    paymentPendingLabel: "Pending",
    billingTitle: "Billing information",
    summaryTitle: "Order summary",
    summaryLabels: {
      subtotal: "Product price",
      shipping: "Delivery",
      tax: "Taxes",
      total: "Total"
    },
    metaLabels: {
      created: "Created",
      channel: "Channel",
      buyer: "Buyer",
      buyerEmail: "Buyer email",
      jurisdiction: "Jurisdiction",
      currency: "Currency"
    },
    trackLabels: {
      received: "Order received",
      confirmed: "Order confirmed",
      packed: "Order packed",
      shipped: "Order shipped",
      delivered: "Order delivered"
    },
    trackIcons: {
      received: "Bell",
      confirmed: "FileText",
      packed: "Package",
      shipped: "Truck",
      delivered: "Check"
    },
    trackIconFallback: "CircleDot",
    trackSteps: [
      { key: "received", label: "Order received", icon: "Bell", match: ["received", "created", "intake"] },
      { key: "confirmed", label: "Order confirmed", icon: "FileText", match: ["confirmed", "order_confirm", "order_approve"] },
      { key: "packed", label: "Order packed", icon: "Package", match: ["packed", "order_pack"] },
      { key: "shipped", label: "Order transmitted to courier", icon: "Truck", match: ["shipped", "order_ship", "order_transmit"] },
      { key: "delivered", label: "Order delivered", icon: "Check", match: ["delivered", "order_deliver", "order_fulfill", "fulfilled"] }
    ],
    fulfillmentTitle: "Fulfillment",
    lineItemsTitle: "Line items",
    lineItemLabel: "Item",
    lineItemsQtyLabel: "Qty",
    lineItemsAtLabel: "@",
    lineItemsEmpty: "No order lines recorded.",
    customerRequestsTitle: "Customer requests",
    returnReasonLabel: "Return reason",
    requestReturnLabel: "Request return",
    refundLabel: "Refund",
    refundReasonPlaceholder: "Reason",
    refundAmountPlaceholder: "Amount (leave blank for full refund)",
    requestRefundLabel: "Request refund",
    returnsTitle: "Returns",
    returnsEmpty: "No returns yet.",
    refundsTitle: "Refunds",
    refundsEmpty: "No refunds yet.",
    paymentsTitle: "Payments",
    paymentsEmpty: "No payments yet.",
    returnTitle: "Return",
    refundTitle: "Refund",
    paymentTitle: "Payment",
    orderLabel: "Order",
    amountLabel: "Amount",
    actionLabels: {
      order: {
        ORDER_CONFIRM: "Confirm",
        ORDER_PACK: "Pack",
        ORDER_SHIP: "Ship",
        ORDER_FULFILL: "Fulfill",
        ORDER_DELIVER: "Deliver",
        ORDER_CANCEL: "Cancel"
      },
      return: {
        RETURN_APPROVE: "Approve",
        RETURN_REJECT: "Reject",
        RETURN_RECEIVE: "Receive"
      },
      refund: {
        REFUND_APPROVE: "Approve",
        REFUND_REJECT: "Reject",
        REFUND_ISSUE: "Issue"
      }
    },
    messages: {
      loadingOrder: "Loading order...",
      loadingReturn: "Loading return...",
      loadingRefund: "Loading refund...",
      loadingPayment: "Loading payment...",
      selectOrder: "Select an order to see details.",
      selectReturn: "Select a return to see details.",
      selectRefund: "Select a refund to see details.",
      selectPayment: "Select a payment to see details.",
      orderUpdated: "Order updated.",
      returnRequestCreated: "Return request created.",
      refundRequestCreated: "Refund request created.",
      paymentUpdated: "Payment updated."
    },
    skeleton: {
      enabled: true,
      timePlaceholder: "-",
      lineItemsCount: 2
    }
  }
};

function resolveLayout(overrides) {
  const detailOverrides = overrides?.detail || {};
  return {
    header: { ...DEFAULT_LAYOUT.header, ...(overrides?.header || {}) },
    tabs:
      Array.isArray(overrides?.tabs) && overrides.tabs.length ? overrides.tabs : DEFAULT_LAYOUT.tabs,
    list: { ...DEFAULT_LAYOUT.list, ...(overrides?.list || {}) },
    detail: {
      ...DEFAULT_LAYOUT.detail,
      ...detailOverrides,
      summaryLabels: {
        ...DEFAULT_LAYOUT.detail.summaryLabels,
        ...(detailOverrides.summaryLabels || {})
      },
      metaLabels: {
        ...DEFAULT_LAYOUT.detail.metaLabels,
        ...(detailOverrides.metaLabels || {})
      },
      trackLabels: {
        ...DEFAULT_LAYOUT.detail.trackLabels,
        ...(detailOverrides.trackLabels || {})
      },
      trackSteps:
        Array.isArray(detailOverrides.trackSteps) && detailOverrides.trackSteps.length
          ? detailOverrides.trackSteps
          : DEFAULT_LAYOUT.detail.trackSteps,
      actionLabels: {
        order: {
          ...DEFAULT_LAYOUT.detail.actionLabels.order,
          ...(detailOverrides.actionLabels?.order || {})
        },
        return: {
          ...DEFAULT_LAYOUT.detail.actionLabels.return,
          ...(detailOverrides.actionLabels?.return || {})
        },
        refund: {
          ...DEFAULT_LAYOUT.detail.actionLabels.refund,
          ...(detailOverrides.actionLabels?.refund || {})
        }
      },
      messages: {
        ...DEFAULT_LAYOUT.detail.messages,
        ...(detailOverrides.messages || {})
      },
      skeleton: {
        ...DEFAULT_LAYOUT.detail.skeleton,
        ...(detailOverrides.skeleton || {})
      }
    }
  };
}

function parseApiError(err) {
  const message = err?.message || "";
  const match = message.match(/API\s+(\d+):\s*(.*)$/s);
  if (!match) return { status: null, error: null, raw: message };
  const status = Number(match[1]);
  const raw = match[2]?.trim() || "";
  try {
    const payload = JSON.parse(raw);
    return { status, error: payload?.error || null, raw, payload };
  } catch {
    return { status, error: null, raw };
  }
}

function formatApiError(err, fallback) {
  const parsed = parseApiError(err);
  const code = parsed.error || "";
  if (code === "FORBIDDEN" || parsed.status === 403) {
    return "Access denied. Ask an admin to grant commerce permissions.";
  }
  if (code === "UNAUTHENTICATED") {
    return "Session expired. Please sign in again.";
  }
  if (code === "PROCESS_BINDING_REQUIRED") {
    return "Order workflow is not configured for this tenant. Ask an administrator to complete tenant setup.";
  }
  if (code === "INVALID_TRANSITION") {
    return "Action not allowed from the current stage.";
  }
  if (code === "RETURN_DISABLED") {
    return "Returns are disabled in commerce settings.";
  }
  if (code === "REFUND_DISABLED") {
    return "Refunds are disabled in commerce settings.";
  }
  if (code === "AMOUNT_REQUIRED") {
    return "Refund amount is required.";
  }
  return fallback || parsed.raw || "Request failed.";
}

function formatMoney(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "-";
  const code = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pickOrderItemImage(item) {
  if (!item) return "";
  return (
    item.image_url ||
    item.image ||
    item.attrs?.media?.hero_url ||
    item.attrs?.media?.hero_asset?.url ||
    item.attrs?.media?.preview_url ||
    ""
  );
}

function formatStageLabel(value, fallback) {
  if (!value) return fallback || "New";
  const normalized = String(value).replace(/_/g, " ").toLowerCase();
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeTrackKey(value) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return "";
  if (raw.includes("deliver") || raw.includes("fulfill")) return "delivered";
  if (raw.includes("ship") || raw.includes("transmit")) return "shipped";
  if (raw.includes("pack")) return "packed";
  if (raw.includes("confirm") || raw.includes("approve")) return "confirmed";
  if (raw.includes("receive") || raw.includes("created") || raw.includes("intake")) return "received";
  return raw;
}

export default function EcomOrderManagementPanel({ node }) {
  const layout = resolveLayout(node?.props?.layout);
  const [activeTab, setActiveTab] = useState(() => layout.tabs[0]?.id || "orders");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(
    () => layout.list.perPageOptions?.[0] || 12
  );
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [orderRefresh, setOrderRefresh] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderNotice, setOrderNotice] = useState("");

  const [returns, setReturns] = useState([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState("");
  const [returnRefresh, setReturnRefresh] = useState(0);
  const [selectedReturnId, setSelectedReturnId] = useState(null);
  const [returnDetail, setReturnDetail] = useState(null);
  const [returnDetailLoading, setReturnDetailLoading] = useState(false);

  const [refunds, setRefunds] = useState([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsError, setRefundsError] = useState("");
  const [refundRefresh, setRefundRefresh] = useState(0);
  const [selectedRefundId, setSelectedRefundId] = useState(null);
  const [refundDetail, setRefundDetail] = useState(null);
  const [refundDetailLoading, setRefundDetailLoading] = useState(false);

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [paymentDetailLoading, setPaymentDetailLoading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");

  const [returnReason, setReturnReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [paymentRefundReason, setPaymentRefundReason] = useState("");
  const [paymentRefundAmount, setPaymentRefundAmount] = useState("");
  const [actionPending, setActionPending] = useState(false);

  const orderTotals = useMemo(() => {
    const totals = orderDetail?.order?.attrs?.pricing_snapshot?.totals || {};
    return {
      subtotal: totals.subtotal,
      discount: totals.discount_total,
      shipping: totals.shipping_total ?? totals.shipping,
      tax: totals.tax_total,
      total: totals.total
    };
  }, [orderDetail]);

  const buyer = orderDetail?.order?.attrs?.buyer || {};
  const buyerName = buyer.name || buyer.attrs?.name || "-";
  const buyerEmail = buyer.attrs?.email || buyer.email || "-";
  const orderStage = orderDetail?.order?.stage || orderDetail?.order?.status;
  const orderStageLabel = formatStageLabel(orderStage, layout.list.stageFallback);
  const orderPrimaryItem = orderDetail?.items?.[0] || null;
  const orderPrimaryName =
    orderPrimaryItem?.title ||
    orderPrimaryItem?.name ||
    orderPrimaryItem?.material_name ||
    orderDetail?.order?.title ||
    orderDetail?.order?.code ||
    layout.detail.untitledItem;
  const orderPrimaryImage = pickOrderItemImage(orderPrimaryItem);
  const primaryPayment = orderDetail?.payments?.[0] || null;
  const billingInfo =
    orderDetail?.order?.attrs?.billing ||
    orderDetail?.order?.attrs?.billing_address ||
    orderDetail?.order?.attrs?.buyer ||
    {};
  const billingName = billingInfo.name || billingInfo.attrs?.name || buyerName;
  const billingEmail = billingInfo.email || billingInfo.attrs?.email || buyerEmail;
  const orderSkeleton = layout.detail.skeleton || {};
  const orderSkeletonEnabled = orderSkeleton.enabled !== false;
  const skeletonLineCount =
    Number.isFinite(Number(orderSkeleton.lineItemsCount)) && Number(orderSkeleton.lineItemsCount) > 0
      ? Number(orderSkeleton.lineItemsCount)
      : 2;
  const skeletonLineItems = Array.from({ length: skeletonLineCount });
  const skeletonTrackSteps =
    Array.isArray(layout.detail.trackSteps) && layout.detail.trackSteps.length
      ? layout.detail.trackSteps.map((step) => ({ key: step.key, label: step.label, icon: step.icon }))
      : [
          { key: "received", label: layout.detail.trackLabels.received },
          { key: "confirmed", label: layout.detail.trackLabels.confirmed },
          { key: "packed", label: layout.detail.trackLabels.packed },
          { key: "shipped", label: layout.detail.trackLabels.shipped },
          { key: "delivered", label: layout.detail.trackLabels.delivered }
        ].filter((item) => item.label);

  const trackingSteps = useMemo(() => {
    const trackIcons = layout.detail.trackIcons || {};
    const fallbackIcon = layout.detail.trackIconFallback || "CircleDot";
    const stepDefs = Array.isArray(layout.detail.trackSteps) && layout.detail.trackSteps.length
      ? layout.detail.trackSteps
      : Object.keys(layout.detail.trackLabels || {}).map((key) => ({
          key,
          label: layout.detail.trackLabels[key],
          icon: trackIcons[key]
        }));
    const history =
      orderDetail?.order?.attrs?.workflow?.history ||
      orderDetail?.order?.attrs?.history ||
      orderDetail?.order?.attrs?.events;
    const normalizedStage = normalizeTrackKey(orderStage);
    const stageIndex = stepDefs.findIndex((step) => {
      const matchList = Array.isArray(step.match) ? step.match : step.matches || step.stageKeys;
      if (Array.isArray(matchList) && matchList.length) {
        return matchList.map(normalizeTrackKey).includes(normalizedStage);
      }
      return normalizeTrackKey(step.key) === normalizedStage;
    });

    return stepDefs.map((step, index) => {
      const matchList = Array.isArray(step.match) ? step.match : step.matches || step.stageKeys;
      const matches = Array.isArray(matchList) && matchList.length
        ? matchList.map(normalizeTrackKey)
        : [normalizeTrackKey(step.key)];
      let matchedEntry = null;
      if (Array.isArray(history) && history.length) {
        matchedEntry = history
          .slice()
          .reverse()
          .find((entry) => matches.includes(normalizeTrackKey(entry.stage || entry.status || entry.action || entry.id || entry.label)));
      }
      const time = formatDate(matchedEntry?.at || matchedEntry?.timestamp || matchedEntry?.created_at);
      const done = matchedEntry
        ? Boolean(matchedEntry.at || matchedEntry.timestamp || matchedEntry.created_at)
        : stageIndex !== -1 && index <= stageIndex;
      const displayTime = time === "-" ? orderSkeleton.timePlaceholder : time;
      return {
        id: step.key || `${index}`,
        label: step.label || formatStageLabel(step.key, layout.list.stageFallback),
        time: displayTime,
        done,
        iconKey: step.icon || trackIcons[step.key] || fallbackIcon
      };
    });
  }, [
    layout.detail.trackLabels,
    layout.detail.trackIcons,
    layout.detail.trackIconFallback,
    layout.detail.trackSteps,
    layout.list.stageFallback,
    orderDetail,
    orderStage
  ]);

  const filteredOrders = useMemo(() => {
    const query = orderQuery.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((item) => {
      const buyerMeta = item.attrs?.buyer || {};
      const lineItems = item.attrs?.items || item.attrs?.line_items || item.items || [];
      const itemNames = Array.isArray(lineItems)
        ? lineItems
            .map((entry) => entry?.title || entry?.name || entry?.material_name || entry?.material_code)
            .filter(Boolean)
        : [];
      const searchParts = [
        item.code,
        item.order_code,
        item.title,
        item.status,
        item.stage,
        buyerMeta.name,
        buyerMeta.email,
        ...itemNames
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchParts.includes(query);
    });
  }, [orders, orderQuery]);

  const orderTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / orderPageSize)),
    [filteredOrders.length, orderPageSize]
  );

  const pagedOrders = useMemo(() => {
    const start = (orderPage - 1) * orderPageSize;
    return filteredOrders.slice(start, start + orderPageSize);
  }, [filteredOrders, orderPage, orderPageSize]);

  const orderPageNumbers = useMemo(() => {
    const pages = [];
    if (orderTotalPages <= 6) {
      for (let i = 1; i <= orderTotalPages; i += 1) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (orderPage > 3) pages.push("ellipsis-start");
    const start = Math.max(2, orderPage - 1);
    const end = Math.min(orderTotalPages - 1, orderPage + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (orderPage < orderTotalPages - 2) pages.push("ellipsis-end");
    pages.push(orderTotalPages);
    return pages;
  }, [orderPage, orderTotalPages]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderQuery, orderPageSize]);

  useEffect(() => {
    if (!layout.tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(layout.tabs[0]?.id || "orders");
    }
  }, [activeTab, layout.tabs]);

  useEffect(() => {
    const options = layout.list.perPageOptions || [];
    if (options.length && !options.includes(orderPageSize)) {
      setOrderPageSize(options[0]);
    }
  }, [layout.list.perPageOptions, orderPageSize]);

  useEffect(() => {
    if (orderPage > orderTotalPages) {
      setOrderPage(orderTotalPages);
    }
  }, [orderPage, orderTotalPages]);

  useEffect(() => {
    if (activeTab !== "orders") return;
    if (!filteredOrders.length) {
      setSelectedOrderId(null);
      return;
    }
    setSelectedOrderId((prev) => {
      if (!prev) return filteredOrders[0].id;
      if (!filteredOrders.some((item) => item.id === prev)) return filteredOrders[0].id;
      return prev;
    });
  }, [activeTab, filteredOrders]);

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const data = await apiFetch("/api/eip/commerce/orders");
        if (!active) return;
        const items = data?.items || [];
        setOrders(items);
      } catch (err) {
        if (active) setOrdersError(formatApiError(err, "Failed to load orders."));
      } finally {
        if (active) setOrdersLoading(false);
      }
    }

    loadOrders();
    return () => {
      active = false;
    };
  }, [orderRefresh]);

  async function fetchOrderDetail(id) {
    if (!id) {
      setOrderDetail(null);
      return;
    }
    setOrderDetailLoading(true);
    setOrderNotice("");
    try {
      const data = await apiFetch(`/api/eip/commerce/orders/${id}`);
      setOrderDetail(data);
    } catch (err) {
      setOrderNotice(formatApiError(err, "Failed to load order."));
      setOrderDetail(null);
    } finally {
      setOrderDetailLoading(false);
    }
  }

  useEffect(() => {
    fetchOrderDetail(selectedOrderId);
  }, [selectedOrderId]);

  useEffect(() => {
    setReturnReason("");
    setRefundReason("");
    setRefundAmount("");
  }, [orderDetail?.order?.id]);

  useEffect(() => {
    let active = true;
    async function loadReturns() {
      setReturnsLoading(true);
      setReturnsError("");
      try {
        const data = await apiFetch("/api/eip/commerce/returns");
        if (!active) return;
        const items = data?.items || [];
        setReturns(items);
        setSelectedReturnId((prev) => {
          if (!items.length) return null;
          if (!prev) return items[0].id;
          if (!items.some((item) => item.id === prev)) return items[0].id;
          return prev;
        });
      } catch (err) {
        if (active) setReturnsError(formatApiError(err, "Failed to load returns."));
      } finally {
        if (active) setReturnsLoading(false);
      }
    }

    if (activeTab === "returns") loadReturns();
    return () => {
      active = false;
    };
  }, [activeTab, returnRefresh]);

  async function fetchReturnDetail(id) {
    if (!id) {
      setReturnDetail(null);
      return;
    }
    setReturnDetailLoading(true);
    try {
      const data = await apiFetch(`/api/eip/commerce/returns/${id}`);
      setReturnDetail(data?.item || null);
    } catch (err) {
      setReturnsError(formatApiError(err, "Failed to load return."));
      setReturnDetail(null);
    } finally {
      setReturnDetailLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "returns") fetchReturnDetail(selectedReturnId);
  }, [selectedReturnId, activeTab]);

  useEffect(() => {
    let active = true;
    async function loadRefunds() {
      setRefundsLoading(true);
      setRefundsError("");
      try {
        const data = await apiFetch("/api/eip/commerce/refunds");
        if (!active) return;
        const items = data?.items || [];
        setRefunds(items);
        setSelectedRefundId((prev) => {
          if (!items.length) return null;
          if (!prev) return items[0].id;
          if (!items.some((item) => item.id === prev)) return items[0].id;
          return prev;
        });
      } catch (err) {
        if (active) setRefundsError(formatApiError(err, "Failed to load refunds."));
      } finally {
        if (active) setRefundsLoading(false);
      }
    }

    if (activeTab === "refunds") loadRefunds();
    return () => {
      active = false;
    };
  }, [activeTab, refundRefresh]);

  async function fetchRefundDetail(id) {
    if (!id) {
      setRefundDetail(null);
      return;
    }
    setRefundDetailLoading(true);
    try {
      const data = await apiFetch(`/api/eip/commerce/refunds/${id}`);
      setRefundDetail(data?.item || null);
    } catch (err) {
      setRefundsError(formatApiError(err, "Failed to load refund."));
      setRefundDetail(null);
    } finally {
      setRefundDetailLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "refunds") fetchRefundDetail(selectedRefundId);
  }, [selectedRefundId, activeTab]);

  useEffect(() => {
    let active = true;
    async function loadPayments() {
      setPaymentsLoading(true);
      setPaymentsError("");
      try {
        const data = await apiFetch("/api/eip/commerce/payments");
        if (!active) return;
        const items = data?.items || [];
        setPayments(items);
        setSelectedPaymentId((prev) => {
          if (!items.length) return null;
          if (!prev) return items[0].id;
          if (!items.some((item) => item.id === prev)) return items[0].id;
          return prev;
        });
      } catch (err) {
        if (active) setPaymentsError(formatApiError(err, "Failed to load payments."));
      } finally {
        if (active) setPaymentsLoading(false);
      }
    }

    if (activeTab === "payments") loadPayments();
    return () => {
      active = false;
    };
  }, [activeTab, paymentRefresh]);

  async function fetchPaymentDetail(id) {
    if (!id) {
      setPaymentDetail(null);
      return;
    }
    setPaymentDetailLoading(true);
    setPaymentNotice("");
    try {
      const data = await apiFetch(`/api/eip/commerce/payments/${id}`);
      setPaymentDetail(data?.item || null);
    } catch (err) {
      setPaymentsError(formatApiError(err, "Failed to load payment."));
      setPaymentDetail(null);
    } finally {
      setPaymentDetailLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "payments") fetchPaymentDetail(selectedPaymentId);
  }, [selectedPaymentId, activeTab]);

  async function runOrderAction(action) {
    if (!orderDetail?.order?.id) return;
    setActionPending(true);
    setOrderNotice("");
    try {
      await apiFetch(`/api/eip/commerce/orders/${orderDetail.order.id}/actions`, {
        method: "POST",
        body: { action }
      });
      setOrderNotice(layout.detail.messages.orderUpdated);
      setOrderRefresh((tick) => tick + 1);
      await fetchOrderDetail(orderDetail.order.id);
    } catch (err) {
      setOrderNotice(formatApiError(err, "Order action failed."));
    } finally {
      setActionPending(false);
    }
  }

  async function requestReturn() {
    if (!orderDetail?.order?.id) return;
    setActionPending(true);
    setOrderNotice("");
    try {
      await apiFetch(`/api/eip/commerce/orders/${orderDetail.order.id}/returns`, {
        method: "POST",
        body: { reason: returnReason }
      });
      setOrderNotice(layout.detail.messages.returnRequestCreated);
      setReturnReason("");
      setOrderRefresh((tick) => tick + 1);
      await fetchOrderDetail(orderDetail.order.id);
    } catch (err) {
      setOrderNotice(formatApiError(err, "Return request failed."));
    } finally {
      setActionPending(false);
    }
  }

  async function requestRefund() {
    if (!orderDetail?.order?.id) return;
    setActionPending(true);
    setOrderNotice("");
    try {
      const payload = { reason: refundReason };
      if (refundAmount) payload.amount = Number(refundAmount);
      await apiFetch(`/api/eip/commerce/orders/${orderDetail.order.id}/refunds`, {
        method: "POST",
        body: payload
      });
      setOrderNotice(layout.detail.messages.refundRequestCreated);
      setRefundReason("");
      setRefundAmount("");
      setRefundRefresh((tick) => tick + 1);
      await fetchOrderDetail(orderDetail.order.id);
    } catch (err) {
      setOrderNotice(formatApiError(err, "Refund request failed."));
    } finally {
      setActionPending(false);
    }
  }

  async function runReturnAction(action) {
    if (!returnDetail?.id) return;
    setActionPending(true);
    setReturnsError("");
    try {
      await apiFetch(`/api/eip/commerce/returns/${returnDetail.id}/actions`, {
        method: "POST",
        body: { action }
      });
      setReturnRefresh((tick) => tick + 1);
      await fetchReturnDetail(returnDetail.id);
    } catch (err) {
      setReturnsError(formatApiError(err, "Return action failed."));
    } finally {
      setActionPending(false);
    }
  }

  async function runRefundAction(action) {
    if (!refundDetail?.id) return;
    setActionPending(true);
    setRefundsError("");
    try {
      await apiFetch(`/api/eip/commerce/refunds/${refundDetail.id}/actions`, {
        method: "POST",
        body: { action }
      });
      setRefundRefresh((tick) => tick + 1);
      await fetchRefundDetail(refundDetail.id);
    } catch (err) {
      setRefundsError(formatApiError(err, "Refund action failed."));
    } finally {
      setActionPending(false);
    }
  }

  async function runPaymentAction(kind) {
    if (!paymentDetail?.id) return;
    setActionPending(true);
    setPaymentNotice("");
    try {
      const endpoint =
        kind === "capture"
          ? `/api/eip/commerce/payments/${paymentDetail.id}/capture`
          : `/api/eip/commerce/payments/${paymentDetail.id}/cancel`;
      await apiFetch(endpoint, { method: "POST", body: {} });
      setPaymentNotice(layout.detail.messages.paymentUpdated);
      setPaymentRefresh((tick) => tick + 1);
      await fetchPaymentDetail(paymentDetail.id);
    } catch (err) {
      setPaymentNotice(formatApiError(err, "Payment action failed."));
    } finally {
      setActionPending(false);
    }
  }

  async function requestPaymentRefund() {
    if (!paymentDetail?.id) return;
    setActionPending(true);
    setPaymentNotice("");
    try {
      const payload = { reason: paymentRefundReason };
      if (paymentRefundAmount) payload.amount = Number(paymentRefundAmount);
      await apiFetch(`/api/eip/commerce/payments/${paymentDetail.id}/refund-request`, {
        method: "POST",
        body: payload
      });
      setPaymentNotice(layout.detail.messages.refundRequestCreated);
      setPaymentRefundReason("");
      setPaymentRefundAmount("");
      setPaymentRefresh((tick) => tick + 1);
      await fetchPaymentDetail(paymentDetail.id);
    } catch (err) {
      setPaymentNotice(formatApiError(err, "Payment refund request failed."));
    } finally {
      setActionPending(false);
    }
  }

  const activeList =
    activeTab === "orders" ? filteredOrders : activeTab === "returns" ? returns : activeTab === "payments" ? payments : refunds;
  const listItems = activeTab === "orders" ? pagedOrders : activeList;

  const listLoading =
    activeTab === "orders"
      ? ordersLoading
      : activeTab === "returns"
        ? returnsLoading
        : activeTab === "payments"
          ? paymentsLoading
          : refundsLoading;
  const listError =
    activeTab === "orders"
      ? ordersError
      : activeTab === "returns"
        ? returnsError
        : activeTab === "payments"
          ? paymentsError
          : refundsError;
  const selectedId =
    activeTab === "orders"
      ? selectedOrderId
      : activeTab === "returns"
        ? selectedReturnId
        : activeTab === "payments"
          ? selectedPaymentId
          : selectedRefundId;

  function handleSelect(id) {
    if (activeTab === "orders") setSelectedOrderId(id);
    if (activeTab === "returns") setSelectedReturnId(id);
    if (activeTab === "refunds") setSelectedRefundId(id);
    if (activeTab === "payments") setSelectedPaymentId(id);
  }

  return (
    <section className="space-y-6">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
            {layout.header.eyebrow}
          </p>
          <h2 className="text-2xl font-semibold text-ink-900">{layout.header.title}</h2>
          <p className="mt-1 text-sm text-ink-500">{layout.header.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {layout.tabs.map((tab) => {
            const Icon = TAB_ICON_MAP[tab.icon] || ClipboardList;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                  active
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-200 bg-white/70 text-ink-500"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "orders" ? (
        <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-4 py-2 text-sm text-ink-600">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                type="text"
                value={orderQuery}
                onChange={(event) => setOrderQuery(event.target.value)}
                placeholder={layout.list.searchPlaceholder}
                className="w-56 bg-transparent text-sm text-ink-700 outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
              {layout.list.perPageLabel}
              <select
                value={orderPageSize}
                onChange={(event) => setOrderPageSize(Number(event.target.value))}
                className="rounded-md border border-ink-100/70 bg-white/80 px-2 py-1 text-[0.6rem] font-semibold text-ink-600"
              >
                {layout.list.perPageOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => setOrderRefresh((tick) => tick + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500"
          >
            <RefreshCw className="h-4 w-4" />
            {layout.list.refreshLabel}
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                {layout.list.title}
              </p>
              {listLoading ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : null}
            </div>
            {listError ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                {listError}
              </div>
            ) : null}
            <div className="mt-3 space-y-2">
              {activeList.length === 0 && !listLoading ? (
                <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                  {activeTab === "orders" && orderQuery
                    ? layout.list.emptyFiltered
                    : layout.list.empty}
                </div>
              ) : null}
              {listItems.map((item) => {
                const isActive = item.id === selectedId;
                if (activeTab === "orders") {
                  const stage = formatStageLabel(item.stage || item.status, layout.list.stageFallback);
                  const totals = item.attrs?.pricing_snapshot?.totals;
                  const totalValue = totals?.total;
                  const currency = item.attrs?.currency;
                  const buyerMeta = item.attrs?.buyer || {};
                  const lineItems = item.attrs?.items || item.attrs?.line_items || item.items || [];
                  const primaryItem = Array.isArray(lineItems) ? lineItems[0] : null;
                  const productName =
                    primaryItem?.title ||
                    primaryItem?.name ||
                    primaryItem?.material_name ||
                    item.title ||
                    item.code ||
                    layout.list.itemFallback;
                  const thumb = pickOrderItemImage(primaryItem);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-ink-900 bg-ink-900 text-white"
                          : "border-ink-100 bg-white/70 text-ink-700 hover:border-ink-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border ${
                            isActive ? "border-white/20 bg-white/10" : "border-ink-100/70 bg-white/80"
                          }`}
                        >
                          {thumb ? (
                            <img src={thumb} alt={productName} className="h-full w-full object-cover" />
                          ) : (
                            <Image className={`${isActive ? "text-white" : "text-ink-300"} h-5 w-5`} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`text-[0.55rem] uppercase tracking-[0.25em] ${isActive ? "text-white/70" : "text-ink-400"}`}>
                                {item.code || item.order_code || layout.list.codeFallback}
                              </p>
                              <p className="truncate text-sm font-semibold">{productName}</p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] ${
                                isActive ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"
                              }`}
                            >
                              {stage}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[0.65rem] opacity-80">
                            <span className="truncate">
                              {buyerMeta.name || buyerMeta.email || layout.list.buyerFallback}
                            </span>
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                          <div className="mt-1 text-right text-[0.7rem] font-semibold">
                            {formatMoney(totalValue, currency)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                }

                if (activeTab === "payments") {
                  const attrs = item.attrs || {};
                  const status = attrs.payment_status || item.status || layout.list.stageFallback;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-ink-900 bg-ink-900 text-white"
                          : "border-ink-100 bg-white/70 text-ink-700 hover:border-ink-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`text-[0.55rem] uppercase tracking-[0.25em] ${isActive ? "text-white/70" : "text-ink-400"}`}>
                            {item.code || layout.list.untitledFallback}
                          </div>
                          <div className="truncate text-sm font-semibold">
                            {attrs.method || attrs.provider || item.title || layout.detail.paymentTitle}
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] ${
                          isActive ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"
                        }`}>
                          {status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[0.65rem] opacity-80">
                        <span>{item.order_code ? `${layout.list.orderLabel} ${item.order_code}` : attrs.order_code || ""}</span>
                        <span>{formatMoney(attrs.amount, attrs.currency)}</span>
                      </div>
                    </button>
                  );
                }

                const stage = item.stage || item.status;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-ink-100 bg-white/70 text-ink-700 hover:border-ink-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        {item.code || item.title || layout.list.untitledFallback}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] ${
                          isActive ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"
                        }`}
                      >
                        {stage || layout.list.stageFallback}
                      </span>
                    </div>
                    <div className="mt-1 text-xs opacity-80">{item.title || item.order_code || ""}</div>
                    <div className="mt-2 flex items-center justify-between text-[0.65rem] opacity-80">
                      <span>{formatDate(item.created_at)}</span>
                      <span>{item.order_code ? `${layout.list.orderLabel} ${item.order_code}` : ""}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {activeTab === "orders" && filteredOrders.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.6rem] text-ink-400">
                <span>
                  {layout.list.pageLabel} {orderPage} {layout.list.pageOfLabel} {orderTotalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOrderPage((prev) => Math.max(1, prev - 1))}
                    disabled={orderPage === 1}
                    className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
                  >
                    {layout.list.prevLabel}
                  </button>
                  {orderPageNumbers.map((value) =>
                    typeof value === "string" ? (
                      <span key={value} className="px-1 text-[0.6rem] text-ink-400">
                        {layout.list.ellipsisLabel}
                      </span>
                    ) : (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setOrderPage(value)}
                        className={`rounded-full px-2 py-1 text-[0.6rem] font-semibold ${
                          orderPage === value
                            ? "bg-ink-900 text-white"
                            : "border border-ink-100/70 bg-white/70 text-ink-500"
                        }`}
                      >
                        {value}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setOrderPage((prev) => Math.min(orderTotalPages, prev + 1))}
                    disabled={orderPage === orderTotalPages}
                    className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
                  >
                    {layout.list.nextLabel}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          {activeTab === "orders" ? (
            <div className="glass-panel p-5">
              {orderDetailLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {layout.detail.messages.loadingOrder}
                </div>
              ) : orderDetail?.order ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.title}
                      </p>
                      <h3 className="text-xl font-semibold text-ink-900">
                        {layout.detail.orderNumberLabel} {orderDetail.order.code || layout.detail.untitledOrder}
                      </h3>
                      <p className="mt-1 text-sm text-ink-500">
                        {formatDate(orderDetail.order.created_at)} - {layout.detail.orderCodeLabel}{" "}
                        {orderDetail.order.code || "-"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/70 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-600"
                    >
                      <FileText className="h-4 w-4" />
                      {layout.detail.invoiceLabel}
                    </button>
                  </div>

                  {orderNotice ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      {orderNotice}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-white/70 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-ink-100/70 bg-white/80">
                        {orderPrimaryImage ? (
                          <img
                            src={orderPrimaryImage}
                            alt={orderPrimaryName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Image className="h-6 w-6 text-ink-300" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-800">{orderPrimaryName}</p>
                        <p className="mt-1 text-xs text-ink-500">
                          {layout.detail.statusLabel}: {orderStageLabel}
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                          {orderStageLabel}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full bg-ink-900 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white"
                    >
                      {layout.detail.contactLabel}
                    </button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
                    <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.trackTitle}
                      </p>
                      <div className="relative mt-3 space-y-4">
                        <div className="absolute left-3 top-1 bottom-1 w-px bg-ink-100" />
                        {trackingSteps.map((step) => {
                          const Icon = TRACK_ICON_MAP[step.iconKey] || CircleDot;
                          return (
                            <div key={step.id} className="relative flex items-start gap-3">
                              <span
                                className={`z-10 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border ${
                                  step.done
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                    : "border-ink-200 bg-white text-ink-400"
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-ink-700">{step.label}</p>
                                <p className="text-xs text-ink-400">{step.time}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                          {layout.detail.orderPaymentTitle}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900/10">
                              <CreditCard className="h-4 w-4 text-ink-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-ink-700">
                                {primaryPayment?.attrs?.card_last4
                                  ? `**** **** **** ${primaryPayment.attrs.card_last4}`
                                  : primaryPayment?.code || layout.detail.paymentMethodLabel}
                              </p>
                              <p className="text-xs text-ink-400">
                                {primaryPayment?.attrs?.brand ||
                                  primaryPayment?.status ||
                                  layout.detail.paymentPendingLabel}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full border border-ink-100 bg-white/80 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                            {primaryPayment?.status || layout.detail.paymentPendingLabel}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                          {layout.detail.billingTitle}
                        </p>
                        <div className="mt-3 space-y-1 text-sm text-ink-600">
                          <p className="font-semibold text-ink-800">{billingName || "-"}</p>
                          <p>{billingInfo.company || billingInfo.company_name || "-"}</p>
                          <p>{billingEmail || "-"}</p>
                          <p>{billingInfo.vat || billingInfo.vat_number || billingInfo.tax_id || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.summaryTitle}
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-ink-600">
                        <div className="flex items-center justify-between">
                          <span>{layout.detail.summaryLabels.subtotal}</span>
                          <span className="font-semibold text-ink-800">
                            {formatMoney(orderTotals.subtotal, orderDetail.order.attrs?.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{layout.detail.summaryLabels.shipping}</span>
                          <span className="font-semibold text-ink-800">
                            {formatMoney(orderTotals.shipping, orderDetail.order.attrs?.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{layout.detail.summaryLabels.tax}</span>
                          <span className="font-semibold text-ink-800">
                            {formatMoney(orderTotals.tax, orderDetail.order.attrs?.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-base">
                          <span>{layout.detail.summaryLabels.total}</span>
                          <span className="font-semibold text-ink-900">
                            {formatMoney(orderTotals.total, orderDetail.order.attrs?.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                      {layout.detail.fulfillmentTitle}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ORDER_ACTIONS.map((item) => {
                        const label = layout.detail.actionLabels.order[item.action] || item.label;
                        return (
                          <button
                            key={item.action}
                            type="button"
                            onClick={() => runOrderAction(item.action)}
                            disabled={actionPending}
                            className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${item.tone} ${
                              actionPending ? "opacity-60" : "hover:brightness-95"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                      {layout.detail.lineItemsTitle}
                    </p>
                    <div className="mt-3 space-y-2">
                      {orderDetail.items?.length ? (
                        orderDetail.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-ink-100 bg-white/80 px-4 py-3 text-sm text-ink-600"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-ink-800">
                                {item.material_name || item.material_code || layout.detail.lineItemLabel}
                              </div>
                              <span>{formatMoney(item.attrs?.line_total, orderDetail.order.attrs?.currency)}</span>
                            </div>
                            <div className="mt-1 text-xs text-ink-500">
                              {layout.detail.lineItemsQtyLabel} {item.attrs?.quantity || 1} {layout.detail.lineItemsAtLabel}{" "}
                              {formatMoney(item.attrs?.unit_price, orderDetail.order.attrs?.currency)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                          {layout.detail.lineItemsEmpty}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-ink-100 bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                      {layout.detail.customerRequestsTitle}
                    </p>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
                        {layout.detail.returnReasonLabel}
                      </label>
                      <textarea
                        value={returnReason}
                        onChange={(event) => setReturnReason(event.target.value)}
                        rows={2}
                        className="w-full rounded-2xl border border-ink-200 bg-white/80 px-4 py-2 text-sm text-ink-700"
                      />
                      <button
                        type="button"
                        onClick={requestReturn}
                        disabled={actionPending}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {layout.detail.requestReturnLabel}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
                        {layout.detail.refundLabel}
                      </label>
                      <textarea
                        value={refundReason}
                        onChange={(event) => setRefundReason(event.target.value)}
                        rows={2}
                        className="w-full rounded-2xl border border-ink-200 bg-white/80 px-4 py-2 text-sm text-ink-700"
                        placeholder={layout.detail.refundReasonPlaceholder}
                      />
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={(event) => setRefundAmount(event.target.value)}
                        className="w-full rounded-2xl border border-ink-200 bg-white/80 px-4 py-2 text-sm text-ink-700"
                        placeholder={layout.detail.refundAmountPlaceholder}
                      />
                      <button
                        type="button"
                        onClick={requestRefund}
                        disabled={actionPending}
                        className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-700"
                      >
                        <DollarSign className="h-4 w-4" />
                        {layout.detail.requestRefundLabel}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.returnsTitle}
                      </p>
                      <div className="mt-2 space-y-2">
                        {orderDetail.returns?.length ? (
                          orderDetail.returns.map((ret) => (
                            <div
                              key={ret.id}
                              className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white/80 px-4 py-2 text-sm text-ink-600"
                            >
                              <span>{ret.code}</span>
                              <span className="text-xs uppercase tracking-[0.2em] text-ink-400">{ret.status}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                            {layout.detail.returnsEmpty}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.refundsTitle}
                      </p>
                      <div className="mt-2 space-y-2">
                        {orderDetail.refunds?.length ? (
                          orderDetail.refunds.map((ref) => (
                            <div
                              key={ref.id}
                              className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white/80 px-4 py-2 text-sm text-ink-600"
                            >
                              <span>{ref.code}</span>
                              <span className="text-xs uppercase tracking-[0.2em] text-ink-400">{ref.status}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                            {layout.detail.refundsEmpty}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.paymentsTitle}
                      </p>
                      <div className="mt-2 space-y-2">
                        {orderDetail.payments?.length ? (
                          orderDetail.payments.map((pay) => (
                            <div
                              key={pay.id}
                              className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white/80 px-4 py-2 text-sm text-ink-600"
                            >
                              <span>{pay.code}</span>
                              <span className="text-xs uppercase tracking-[0.2em] text-ink-400">{pay.status}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                            {layout.detail.paymentsEmpty}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : orderSkeletonEnabled ? (
                <div className="space-y-6 animate-pulse">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">
                        {layout.detail.title}
                      </p>
                      <div className="mt-2 h-5 w-48 rounded-full bg-ink-100/80" />
                      <div className="mt-2 h-3 w-64 rounded-full bg-ink-100/60" />
                    </div>
                    <div className="h-8 w-24 rounded-full bg-ink-100/80" />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-white/70 p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl border border-ink-100/70 bg-ink-100/70" />
                      <div>
                        <div className="h-4 w-40 rounded-full bg-ink-100/80" />
                        <div className="mt-2 h-3 w-28 rounded-full bg-ink-100/60" />
                        <div className="mt-2 h-5 w-20 rounded-full bg-ink-100/60" />
                      </div>
                    </div>
                    <div className="h-8 w-24 rounded-full bg-ink-900/20" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
                    <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">
                        {layout.detail.trackTitle}
                      </p>
                      <div className="relative mt-3 space-y-4">
                        <div className="absolute left-3 top-1 bottom-1 w-px bg-ink-100" />
                        {skeletonTrackSteps.map((step, index) => {
                          const iconKey =
                            step.icon || layout.detail.trackIcons?.[step.key] || layout.detail.trackIconFallback;
                          const Icon = TRACK_ICON_MAP[iconKey] || CircleDot;
                          return (
                            <div key={`${step.key}-${index}`} className="relative flex items-start gap-3">
                              <span className="z-10 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-300">
                                <Icon className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-ink-400">{step.label}</p>
                                <p className="text-xs text-ink-300">{orderSkeleton.timePlaceholder}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">
                          {layout.detail.orderPaymentTitle}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900/10" />
                            <div>
                              <div className="h-3 w-32 rounded-full bg-ink-100/70" />
                              <div className="mt-2 h-3 w-20 rounded-full bg-ink-100/60" />
                            </div>
                          </div>
                          <div className="h-5 w-16 rounded-full bg-ink-100/70" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">
                          {layout.detail.billingTitle}
                        </p>
                        <div className="mt-3 space-y-2">
                          <div className="h-3 w-32 rounded-full bg-ink-100/70" />
                          <div className="h-3 w-40 rounded-full bg-ink-100/60" />
                          <div className="h-3 w-36 rounded-full bg-ink-100/60" />
                          <div className="h-3 w-28 rounded-full bg-ink-100/60" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">
                        {layout.detail.summaryTitle}
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-ink-400">
                        {[layout.detail.summaryLabels.subtotal, layout.detail.summaryLabels.shipping, layout.detail.summaryLabels.tax].map(
                          (label) => (
                            <div key={label} className="flex items-center justify-between">
                              <span>{label}</span>
                              <span className="h-3 w-16 rounded-full bg-ink-100/70" />
                            </div>
                          )
                        )}
                        <div className="flex items-center justify-between text-base">
                          <span>{layout.detail.summaryLabels.total}</span>
                          <span className="h-4 w-20 rounded-full bg-ink-100/80" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">
                      {layout.detail.fulfillmentTitle}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ORDER_ACTIONS.map((item) => (
                        <span
                          key={item.action}
                          className="rounded-full bg-ink-100/70 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-300"
                        >
                          {layout.detail.actionLabels.order[item.action] || item.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">
                      {layout.detail.lineItemsTitle}
                    </p>
                    <div className="mt-3 space-y-2">
                      {skeletonLineItems.map((_, index) => (
                        <div
                          key={`line-${index}`}
                          className="rounded-2xl border border-ink-100 bg-white/80 px-4 py-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="h-3 w-32 rounded-full bg-ink-100/70" />
                            <div className="h-3 w-16 rounded-full bg-ink-100/70" />
                          </div>
                          <div className="mt-2 h-3 w-40 rounded-full bg-ink-100/60" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-ink-100 bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">
                      {layout.detail.customerRequestsTitle}
                    </p>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-300">
                        {layout.detail.returnReasonLabel}
                      </label>
                      <div className="h-16 w-full rounded-2xl border border-ink-200 bg-white/80" />
                      <div className="h-8 w-40 rounded-full bg-ink-100/70" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-300">
                        {layout.detail.refundLabel}
                      </label>
                      <div className="h-16 w-full rounded-2xl border border-ink-200 bg-white/80" />
                      <div className="h-10 w-full rounded-2xl border border-ink-200 bg-white/80" />
                      <div className="h-8 w-40 rounded-full bg-ink-100/70" />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {[layout.detail.returnsTitle, layout.detail.refundsTitle, layout.detail.paymentsTitle].map(
                      (label) => (
                        <div key={label}>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-300">{label}</p>
                          <div className="mt-2 rounded-2xl border border-ink-100 bg-white/70 px-4 py-3">
                            <div className="h-3 w-28 rounded-full bg-ink-100/70" />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                  {layout.detail.messages.selectOrder}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "returns" ? (
            <div className="glass-panel p-5">
              {returnDetailLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {layout.detail.messages.loadingReturn}
                </div>
              ) : returnDetail ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.returnTitle}
                      </p>
                      <h3 className="text-xl font-semibold text-ink-900">{returnDetail.code}</h3>
                    </div>
                    <span className="rounded-full border border-ink-200 bg-white/70 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-500">
                      {returnDetail.status}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-600">
                    {layout.detail.orderLabel} {returnDetail.order_code || returnDetail.attrs?.order_code || "-"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {RETURN_ACTIONS.map((item) => {
                      const label = layout.detail.actionLabels.return[item.action] || item.label;
                      return (
                        <button
                          key={item.action}
                          type="button"
                          onClick={() => runReturnAction(item.action)}
                          disabled={actionPending}
                          className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${item.tone}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                  {layout.detail.messages.selectReturn}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "refunds" ? (
            <div className="glass-panel p-5">
              {refundDetailLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {layout.detail.messages.loadingRefund}
                </div>
              ) : refundDetail ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.refundTitle}
                      </p>
                      <h3 className="text-xl font-semibold text-ink-900">{refundDetail.code}</h3>
                    </div>
                    <span className="rounded-full border border-ink-200 bg-white/70 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-500">
                      {refundDetail.status}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-600">
                    {layout.detail.orderLabel} {refundDetail.order_code || refundDetail.attrs?.order_code || "-"}
                  </div>
                  <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-600">
                    {layout.detail.amountLabel}{" "}
                    {formatMoney(refundDetail.attrs?.amount, refundDetail.attrs?.currency)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REFUND_ACTIONS.map((item) => {
                      const label = layout.detail.actionLabels.refund[item.action] || item.label;
                      return (
                        <button
                          key={item.action}
                          type="button"
                          onClick={() => runRefundAction(item.action)}
                          disabled={actionPending}
                          className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${item.tone}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                  {layout.detail.messages.selectRefund}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "payments" ? (
            <div className="glass-panel p-5">
              {paymentDetailLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {layout.detail.messages.loadingPayment}
                </div>
              ) : paymentDetail ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                        {layout.detail.paymentTitle}
                      </p>
                      <h3 className="text-xl font-semibold text-ink-900">{paymentDetail.code}</h3>
                    </div>
                    <span className="rounded-full border border-ink-200 bg-white/70 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-500">
                      {paymentDetail.attrs?.payment_status || paymentDetail.status}
                    </span>
                  </div>
                  {paymentNotice ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      {paymentNotice}
                    </div>
                  ) : null}
                  <div className="grid gap-3 rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-600 md:grid-cols-2">
                    <div>
                      <span className="font-semibold text-ink-800">{layout.detail.orderLabel}:</span>{" "}
                      {paymentDetail.order_code || paymentDetail.attrs?.order_code || "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-ink-800">{layout.detail.amountLabel}:</span>{" "}
                      {formatMoney(paymentDetail.attrs?.amount, paymentDetail.attrs?.currency)}
                    </div>
                    <div>
                      <span className="font-semibold text-ink-800">Method:</span>{" "}
                      {paymentDetail.attrs?.method || "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-ink-800">Provider:</span>{" "}
                      {paymentDetail.attrs?.provider || "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-ink-800">Environment:</span>{" "}
                      {paymentDetail.attrs?.environment || "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-ink-800">Capture:</span>{" "}
                      {paymentDetail.attrs?.capture_mode || "-"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => runPaymentAction("capture")}
                      disabled={actionPending}
                      className="rounded-full bg-emerald-100 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-emerald-700 disabled:opacity-60"
                    >
                      Capture
                    </button>
                    <button
                      type="button"
                      onClick={() => runPaymentAction("cancel")}
                      disabled={actionPending}
                      className="rounded-full bg-rose-100 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-rose-700 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid gap-2 rounded-2xl border border-ink-100 bg-white/70 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
                      {layout.detail.refundLabel}
                    </label>
                    <textarea
                      value={paymentRefundReason}
                      onChange={(event) => setPaymentRefundReason(event.target.value)}
                      rows={2}
                      className="w-full rounded-2xl border border-ink-200 bg-white/80 px-4 py-2 text-sm text-ink-700"
                      placeholder={layout.detail.refundReasonPlaceholder}
                    />
                    <input
                      type="number"
                      value={paymentRefundAmount}
                      onChange={(event) => setPaymentRefundAmount(event.target.value)}
                      className="w-full rounded-2xl border border-ink-200 bg-white/80 px-4 py-2 text-sm text-ink-700"
                      placeholder={layout.detail.refundAmountPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={requestPaymentRefund}
                      disabled={actionPending}
                      className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-700 disabled:opacity-60"
                    >
                      <DollarSign className="h-4 w-4" />
                      {layout.detail.requestRefundLabel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
                  {layout.detail.messages.selectPayment}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
