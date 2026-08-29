/** Carrier shipment wording, shared by the buyer and seller order screens. */
export function formatShipmentStatus(status: string | null | undefined): string {
  switch (status) {
    case 'Pending':
      return 'Awaiting pickup booking';
    case 'Created':
      return 'Booked with carrier';
    case 'PickedUp':
      return 'Picked up';
    case 'InTransit':
      return 'Out for delivery';
    case 'Delivered':
      return 'Delivered';
    case 'Failed':
      return 'Delivery failed';
    case 'Returned':
      return 'Returned to seller';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return status?.trim() || 'Unknown';
  }
}
