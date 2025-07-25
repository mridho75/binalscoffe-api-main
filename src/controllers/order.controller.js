import prisma from "../utils/client.js";
import { setOrderCode } from "../utils/documentPatern.js";
import logger from "../utils/winston.js";
import prism from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pdf from "pdf-creator-node";
import excelJS from "exceljs";

export const insertOrder = async (req, res) => {
  try {
    const data = await prisma.$transaction(async (prisma) => {
      const post = await prisma.orders.create({
        data: {
          code: setOrderCode("ORD-"),
          date: req.body.date,
          total: req.body.total,
          ppn: req.body.ppn,
          grandTotal: req.body.grandTotal,
          userId: Number(req.params.userId),
        },
      });
      // insert detail
      for (let i = 0; i < req.body.detail.length; i++) {
        await prisma.orderdetail.create({
          data: {
            price: req.body.detail[i].price,
            productName: req.body.detail[i].productName,
            qty: req.body.detail[i].qty,
            totalPrice: req.body.detail[i].totalPrice,
            note: req.body.detail[i].note,
            orderId: post.id,
            productId: req.body.detail[i].productId,
          },
        });
        // update stock
        await prisma.product.update({
          where: {
            id: req.body.detail[i].productId,
          },
          data: {
            qty: {
              decrement: req.body.detail[i].qty,
            },
          },
        });
      }
      // delete cart
      await prisma.carts.deleteMany({
        where: {
          userId: Number(req.params.userId),
        },
      });
      return post;
    });
    return res.status(200).json({
      message: "success",
      result: data,
    });
  } catch (error) {
    logger.error(
      "controllers/order.controller.js:insertOrder - " + error.message
    );
    return res.status(500).json({
      message: error.message,
      result: null,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const result = await prisma.orders.findUnique({
      where: {
        id: Number(req.params.id),
      },
      include: {
        Orderdetail: true,
      },
    });
    return res.status(200).json({
      message: "success",
      result,
    });
  } catch (error) {
    logger.error(
      "controllers/order.controller.js:getOrderById - " + error.message
    );
    return res.status(500).json({
      message: error.message,
      result: null,
    });
  }
};

export const getAllOrder = async (req, res) => {
  const last_id = parseInt(req.query.lastId) || 0;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search_query || "";
  let result = [];
  try {
    const searchPattern = `%${search}%`;

    if (last_id < 1) {
      result = await prisma.$queryRaw`
        SELECT id, code, date, total, ppn, grandTotal
        FROM orders
        WHERE (
          code LIKE ${searchPattern}
          OR CAST(date AS CHAR) LIKE ${searchPattern}
          OR CAST(total AS CHAR) LIKE ${searchPattern}
          OR CAST(ppn AS CHAR) LIKE ${searchPattern}
          OR CAST(grandTotal AS CHAR) LIKE ${searchPattern}
        )
        ORDER BY id DESC
        LIMIT ${limit}`;
    } else {
      result = await prisma.$queryRaw`
        SELECT id, code, date, total, ppn, grandTotal
        FROM orders
        WHERE (
          code LIKE ${searchPattern}
          OR CAST(date AS CHAR) LIKE ${searchPattern}
          OR CAST(total AS CHAR) LIKE ${searchPattern}
          OR CAST(ppn AS CHAR) LIKE ${searchPattern}
          OR CAST(grandTotal AS CHAR) LIKE ${searchPattern}
        )
        AND id < ${last_id}
        ORDER BY id DESC
        LIMIT ${limit}`;
    }

    return res.status(200).json({
      message: "success",
      result,
      lastId: result.length > 0 ? result[result.length - 1].id : 0,
      hasMore: result.length >= limit,
    });
  } catch (error) {
    logger.error(
      "controllers/order.controller.js:getAllOrder - " + error.message
    );
    return res.status(500).json({
      message: error.message,
      result: null,
      lastId: 0,
      hasMore: false,
    });
  }
};

export const generatePdf = async (req, res) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const templatePath = path.join(__dirname, "../templates/SalesTemplate.html");
  let html = fs.readFileSync(templatePath, "utf-8");
  let options = {
    format: "A4",
    orientation: "portrait",
    border: "10mm",
    header: { height: "0.1mm", contents: "" },
    footer: {
      height: "28mm",
      contents: {
        default:
          '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>',
      },
    },
  };
  try {
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (isNaN(startDate) && isNaN(endDate)) {
      return res.status(400).json({
        message: "Invalid date format",
        result: null,
      });
    }
    const data = await prisma.orders.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: { select: { name: true } },
        Orderdetail: true,
      },
    });
    let orders = [];
    data.forEach((order, no) => {
      orders.push({
        no: no + 1,
        code: order.code,
        date: new Date(order.date).toLocaleDateString("id-ID"),
        total: Number(order.total).toLocaleString("id-ID"),
        ppn: Number(order.ppn).toLocaleString("id-ID"),
        grandTotal: Number(order.grandTotal).toLocaleString("id-ID"),
        user: order.user.name,
        orderdetail: order.Orderdetail,
      });
    });
    let document = {
      html: html,
      data: { orders: orders },
      type: "buffer",
    };
    const process = await pdf.create(document, options);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Sales.pdf",
    });
    return res.send(process);
  } catch (error) {
    logger.error(
      "controllers/product.controller.js:generatePdf - " + error.message
    );
    return res.status(500).json({
      message: error.message,
      result: null,
    });
  }
};

export const generateExcel = async (req, res) => {
  const workbook = new excelJS.Workbook();
  const worksheet = workbook.addWorksheet("order");
  try {
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (isNaN(startDate) && isNaN(endDate)) {
      return res.status(400).json({
        message: "Invalid date format",
        result: null,
      });
    }
    const data = await prisma.$queryRaw`
      SELECT  o.code, o.date, o.total,o.ppn,o.grandTotal,d.productName,d.price,
      d.qty, d.totalPrice from orders o 
      INNER JOIN orderdetail d ON(d.orderId=o.id)
      WHERE o.date BETWEEN ${startDate} AND ${endDate}`;
    worksheet.columns = [
      { header: "No", key: "s_no", width: 5 },
      { header: "Date", key: "date", width: 15 },
      { header: "Code", key: "code", width: 20 },
      { header: "Total", key: "total", width: 25 },
      { header: "PPN", key: "ppn", width: 20 },
      { header: "Grand Total", key: "grandTotal", width: 20 },
      { header: "Product Name", key: "productName", width: 50 },
      { header: "Price", key: "price", width: 25 },
      { header: "QTY", key: "qty", width: 20 },
      { header: "Total Price", key: "totalPrice", width: 30 },
    ];
    let counter = 1;
    data.map((order) => {
      order.s_no = counter;
      order.total = Number(order.total).toLocaleString("id-ID");
      order.ppn = Number(order.ppn).toLocaleString("id-ID");
      order.grandTotal = Number(order.grandTotal).toLocaleString("id-ID");
      order.price = Number(order.price).toLocaleString("id-ID");
      order.qty = Number(order.qty).toLocaleString("id-ID");
      order.totalPrice = Number(order.totalPrice).toLocaleString("id-ID");
      worksheet.addRow(order);
      counter++;
    });
    let list = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    for (let i = 0; i <= counter; i++) {
      list.forEach((item) => {
        worksheet.getCell(item + i).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
    });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Sales.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error(
      "controllers/product.controller.js:generateExcel - " + error.message
    );
    return res.status(500).json({
      message: error.message,
      result: null,
    });
  }
};

export const orderYearly = async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  try {
    const result = await prisma.$queryRaw`
      SELECT 
        IFNULL(SUM(CASE WHEN MONTH(date) = 1 THEN grandTotal ELSE 0 END), 0) AS order_01,
        IFNULL(SUM(CASE WHEN MONTH(date) = 2 THEN grandTotal ELSE 0 END), 0) AS order_02,
        IFNULL(SUM(CASE WHEN MONTH(date) = 3 THEN grandTotal ELSE 0 END), 0) AS order_03,
        IFNULL(SUM(CASE WHEN MONTH(date) = 4 THEN grandTotal ELSE 0 END), 0) AS order_04,
        IFNULL(SUM(CASE WHEN MONTH(date) = 5 THEN grandTotal ELSE 0 END), 0) AS order_05,
        IFNULL(SUM(CASE WHEN MONTH(date) = 6 THEN grandTotal ELSE 0 END), 0) AS order_06,
        IFNULL(SUM(CASE WHEN MONTH(date) = 7 THEN grandTotal ELSE 0 END), 0) AS order_07,
        IFNULL(SUM(CASE WHEN MONTH(date) = 8 THEN grandTotal ELSE 0 END), 0) AS order_08,
        IFNULL(SUM(CASE WHEN MONTH(date) = 9 THEN grandTotal ELSE 0 END), 0) AS order_09,
        IFNULL(SUM(CASE WHEN MONTH(date) = 10 THEN grandTotal ELSE 0 END), 0) AS order_10,
        IFNULL(SUM(CASE WHEN MONTH(date) = 11 THEN grandTotal ELSE 0 END), 0) AS order_11,
        IFNULL(SUM(CASE WHEN MONTH(date) = 12 THEN grandTotal ELSE 0 END), 0) AS order_12
      FROM orders
      WHERE YEAR(date) = ${year}
    `;
    let arry = [];
    result.map((item) => {
      arry.push(
        ...arry,
        Number(item.order_01),
        Number(item.order_02),
        Number(item.order_03),
        Number(item.order_04),
        Number(item.order_05),
        Number(item.order_06),
        Number(item.order_07),
        Number(item.order_08),
        Number(item.order_09),
        Number(item.order_10),
        Number(item.order_11),
        Number(item.order_12)
      );
    });
    return res.status(200).json({
      message: "success",
      result: arry,
    });
  } catch (error) {
    logger.error(
      "controllers/order.controller.js:orderYearly - " + error.message
    );
    return res.status(500).json({
      message: error.message,
      result: null,
    });
  }
};
