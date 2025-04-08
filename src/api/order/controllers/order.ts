"use strict";

// @ts-ignore
const stripe = require("stripe")(process.env.STRIPE_KEY)

/**
 * order controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    //@ts-ignore
    const { products } = ctx.request.body;
    console.log("📦 Productos recibidos:", products);

    try {
      const lineItems = await Promise.all(
        products.map(async (product) => {
          const item = await strapi.entityService.findOne(
            'api::product.product',
            product.id,
            {
              populate: [] // Agrega relaciones si es necesario (ej: ['images', 'category'])
            }
          );

          console.log("🔍 Producto encontrado en Strapi:", item);

          if (!item) {
            throw new Error(`Producto con ID ${product.id} no encontrado`);
          }

          return {
            price_data: {
              currency: "mxn",
              product_data: {
                name: item.productName
              },
              unit_amount: Math.round(item.price * 100)
            },
            quantity: 1
          };
        })
      );

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: { allowed_countries: ["MX"] },
        payment_method_types: ["card"],
        mode: "payment",
        success_url: process.env.CLIENT_URL + "/success",
        cancel_url: process.env.CLIENT_URL + "/successError",
        line_items: lineItems,
      });

      console.log("✅ Sesión de Stripe creada:", session.id);

      await strapi
        .service("api::order.order")
        .create({ data: { products, stripeId: session.id } });

      return { stripeSession: session };

    } catch (error) {
      console.error("🔥 Error al crear sesión de Stripe:", error.message);
      ctx.response.status = 500;
      return { error };
    }
  },
}));
