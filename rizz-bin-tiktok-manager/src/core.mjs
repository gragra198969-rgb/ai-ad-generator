export const MIN_GROSS_MARGIN = 0.30;
export const MIN_NET_MARGIN = 0.10;

export function moneyCents(value, field = "USD amount") {
  if (typeof value !== "string" && typeof value !== "number") throw Error(field + ": missing amount");
  const s = String(value);
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s)) throw Error(field + ": expected nonnegative USD amount with up to two decimals");
  const [whole, decimal = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw Error(field + ": amount is too large");
  return cents;
}
const usd = cents => "$" + (cents / 100).toFixed(2);

export function assessVariant(variant, evidence) {
  if (!variant?.id) return {eligible:false, issues:["Variant missing"]};
  const issues = [];
  const price = moneyCents(variant.price, "Retail price");
  if (price <= 0) issues.push("Retail price must be positive");
  let unitCost, shipping, fixedFee, otherCosts;
  const costAmount = variant.inventoryItem?.unitCost?.amount;
  if (costAmount == null) issues.push("Supplier unit cost missing in Shopify");
  else {
    unitCost = moneyCents(costAmount, "Supplier unit cost");
    if (unitCost === 0) issues.push("Zero unit cost must be verified");
  }
  if (!evidence || typeof evidence !== "object") issues.push("Missing actual supplier shipping and fee evidence");
  else {
    if (evidence.supplierShippingUsd == null) issues.push("Supplier-billed shipping cost not verified");
    else shipping = moneyCents(evidence.supplierShippingUsd, "Supplier shipping");
    if (evidence.paymentFeeFixedUsd == null) issues.push("Fixed payment fee not verified");
    else fixedFee = moneyCents(evidence.paymentFeeFixedUsd, "Fixed payment fee");
    if (evidence.otherCostsUsd == null) issues.push("Other cost reserve missing");
    else otherCosts = moneyCents(evidence.otherCostsUsd, "Other costs");
    if (typeof evidence.paymentFeePercent !== "number" || !Number.isFinite(evidence.paymentFeePercent) || evidence.paymentFeePercent < 0 || evidence.paymentFeePercent > 100) issues.push("Variable payment fee percentage missing or invalid");
    if (typeof evidence.supplierShippingEvidence !== "string" || evidence.supplierShippingEvidence.trim().length < 8) issues.push("Written supplier shipping evidence reference missing");
  }
  if (variant.inventoryQuantity == null || variant.inventoryQuantity < 1) issues.push("No available inventory");
  if (variant.inventoryPolicy === "CONTINUE") issues.push("Overselling permitted");
  if (variant.inventoryItem?.requiresShipping !== true) issues.push("Shippable product not verified");
  if (variant.requiresComponents) issues.push("Component bundle needs separate fulfillment verification");
  const result = {id:variant.id,title:variant.title,priceUsd:usd(price),issues};
  if ([unitCost,shipping,fixedFee,otherCosts].every(Number.isSafeInteger) && typeof evidence?.paymentFeePercent === "number" && price > 0) {
    const variableFee = Math.ceil(price * evidence.paymentFeePercent / 100);
    const grossProfit = price - unitCost - shipping;
    const netProfit = grossProfit - variableFee - fixedFee - otherCosts;
    result.unitCostUsd = usd(unitCost);
    result.supplierShippingUsd = usd(shipping);
    result.grossMarginPct = +(100 * grossProfit / price).toFixed(2);
    result.netMarginPct = +(100 * netProfit / price).toFixed(2);
    result.netProfitUsd = usd(netProfit);
    if (grossProfit / price < MIN_GROSS_MARGIN - 1e-10) issues.push("Gross margin below 30%");
    if (netProfit / price < MIN_NET_MARGIN - 1e-10) issues.push("Estimated net margin below 10%");
  }
  result.eligible = issues.length === 0;
  return result;
}

export function assessProduct(product, approval) {
  if (!product?.id) throw Error("Product not found");
  const issues = [];
  if (product.status !== "ACTIVE") issues.push("Product not active");
  if (!product.featuredImage?.url) issues.push("Genuine product photo missing");
  if (approval?.productId !== product.id) issues.push("Approval product ID does not match");
  if (approval?.approved !== true) issues.push("Owner approval missing");
  if (approval?.shopApprovedForSelling !== true) issues.push("TikTok Shop seller eligibility not verified");
  if (approval?.supplierFulfillmentConfirmed !== true) issues.push("Supplier fulfillment not verified");
  if (approval?.tiktokCategoryAndAttributesChecked !== true) issues.push("TikTok category and attributes not checked");
  if (approval?.returnPolicyAndShippingChecked !== true) issues.push("TikTok shipping and returns not checked");
  if (typeof approval?.supplierName !== "string" || approval.supplierName.trim().length < 2) issues.push("Supplier missing");
  const variants = product.variants?.nodes || [];
  if (!variants.length) issues.push("Product has no variants");
  if (product.variants?.pageInfo?.hasNextPage) issues.push("Variant list was truncated");
  const audits = variants.map(variant => assessVariant(variant, approval?.variants?.[variant.id]));
  if (audits.some(a => !a.eligible)) issues.push("Some variants do not meet margin or fulfillment requirements");
  return {productId:product.id,productTitle:product.title,eligible:issues.length===0,issues,variants:audits};
}
