# Rizz Bin TikTok Manager — safety-first Shopify publisher

**Status: standalone Node.js prototype in a separate GitHub review branch; NOT an installed ChatGPT plugin, not deployed, and not authorized to publish products yet.**

This tool helps review products in **The Rizz Bin Store** before making them available to **TikTok's Shopify sales channel**. The existing Shopify–TikTok integration performs TikTok catalog synchronization; this tool does **not** bypass TikTok's approval, identity verification, shipping, category, or seller-policy checks.

## What it does

- **Audit** actual Shopify products and supplier-recorded unit costs, inventory, product images, and fulfillment risks.
- **Block** missing cost or evidence, out-of-stock products, overselling, cross-supplier/component bundles, products lacking a genuine image, and anything under **30% gross / 10% estimated net margin** after supplier-billed shipping and fees.
- **Verify** whether an existing product is published to Shopify's TikTok sales channel.
- **Publish** **one explicitly approved active product** to that channel via the official Shopify GraphQL `publishablePublish` mutation. It does not create new products, purchase stock, charge money, enable ads, discount products, or guarantee TikTok Shop listing approval.

## Before running

1. Confirm TikTok Shop verification and shipping/returns settings in TikTok Seller Center, and confirm the TikTok sales channel is connected in Shopify.
2. Create a Shopify Admin API access token for a custom app on **your own store** with the necessary **read_products**, **read_inventory**, **read_publications**, and **write_publications** permissions, to the extent permitted by your Shopify installation. Do not paste tokens into ChatGPT, GitHub issues, or files. Use environment variables.
3. Use **Node.js 20+**. No npm dependencies. `npm test` runs offline.
4. Copy `.env.example` to a local **untracked** `.env`, fill in the values and load it using your shell. The program does not load .env files automatically. Keep the Shopify token in a trusted local terminal or secret manager, not GitHub.

```sh
export SHOPIFY_SHOP_DOMAIN=the-rizz-bin.myshopify.com
export SHOPIFY_ADMIN_TOKEN='read-from-your-secret-manager'
export SHOPIFY_TIKTOK_PUBLICATION_ID=gid://shopify/Publication/207469838526
npm test
npm run audit -- --product gid://shopify/Product/REAL_ID
npm run status -- --product gid://shopify/Product/REAL_ID
```

## Explicit one-product approval gate

Copy `approval.example.json` to `approvals/product.json` (the `approvals/*.json` folder is gitignored). Record the **actual** Shopify product ID and each exact variant ID, the verified supplier shipping cost billed **to you**, payment-processing fees, other cost reserves, and written shipping evidence. Confirm supplier fulfillment, TikTok Shop selling eligibility, category, shipping, and returns. Set `approved: true` only after human review.

> **A customer seeing FREE shipping at checkout does not prove the supplier charges the retailer $0 shipping.** Don't enter zeros unless backed by evidence.

Preview first:

```sh
npm run audit -- --product gid://shopify/Product/REAL_ID --approval approvals/product.json
```

Publish only the reviewed product when every gate passes and you explicitly intend to list it:

```sh
export RIZZ_PUBLISH_CONFIRM=YES_PUBLISH_THIS_PRODUCT
npm run publish -- --product gid://shopify/Product/REAL_ID --approval approvals/product.json --confirm
```

This is **not** a bulk-publishing command. Publication to the Shopify channel is **not equivalent** to TikTok product approval; inspect disapproval messages inside Shopify > TikTok and/or TikTok Seller Center. **No product is posted as a result of cloning this repository.**

## Safety and limitations

- All margin checks assume the recorded Shopify unit cost is accurate. If shipping depends on ZIP code or package combinations, supply a conservative **supplier-confirmed** retailer shipping amount per variant; unknown amounts block publication.
- Estimated net profit accounts for item cost, supplier-billed shipping, payment fee and a reserve supplied by the store owner; actual taxes, ads, returns, and processing contracts may differ. **Never promise profit.**
- The tool uses Shopify's existing channel. TikTok's own review, inventory policy, category attributes, and brand restrictions are independent.
- It does not modify product prices, create orders, fulfill orders, activate SMS, or enable paid ads.
- The approved JSON file should not contain tax IDs, ID scans, customer details, private supplier negotiations, or API tokens.

## How to continue in the cloud

The source is on the `rizz-bin-tiktok-manager-v1` GitHub branch in a separate folder of the existing AI Ad Generator repository. A draft pull request can be reviewed without merging to the live application. GitHub stores and reviews code; this tool will not run automatically in the cloud. For hosted operation, deploy to an authenticated server with a secret manager, after verifying plan and security requirements. **Do not enable an automated scheduler, background publisher, or payment.**

The verified Rizz Bin TikTok publication ID is currently `gid://shopify/Publication/207469838526`; the program fails closed if a different ID is configured. Reverify if you reinstall the channel.

## ChatGPT plugin roadmap

This repository is a safe CLI building block, **not an active ChatGPT connector**. A separate HTTPS-hosted authenticated MCP server can wrap `audit`, `status`, and the guarded `publish` operation. Availability of **custom write-capable MCP connections** depends on ChatGPT plan and workspace permissions; as of October 2026, full custom MCP writes are documented for Business/Enterprise/Edu. **GitHub alone does not give ChatGPT access to run an app.**

## Official resources

- Shopify TikTok product sync: https://help.shopify.com/en/manual/online-sales-channels/social-commerce/tiktok/products
- Shopify publishablePublish: https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/publishablePublish
- Custom MCP app connection: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt