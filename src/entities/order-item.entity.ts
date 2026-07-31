import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * A line in an order: a zone + quantity, with price and name captured as
 * snapshots so historical orders are unaffected by later zone changes.
 * (v1 creates exactly one item per order — single zone per order.)
 */
@Entity({ name: "order_items" })
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_order_items_order_id")
  @Column({ name: "order_id", type: "uuid" })
  orderId!: string;

  @Column({ name: "zone_id", type: "uuid" })
  zoneId!: string;

  @Column({ name: "zone_name", type: "varchar", length: 255 })
  zoneName!: string;

  @Column({ type: "integer" })
  quantity!: number;

  @Column({ name: "unit_price_minor", type: "integer" })
  unitPriceMinor!: number;

  @Column({ name: "total_price_minor", type: "integer" })
  totalPriceMinor!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
