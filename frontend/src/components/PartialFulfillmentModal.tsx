import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';

interface PartialFulfillmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  type: 'DN' | 'GRN';
  onSubmit: (items: any[]) => void;
}

export const PartialFulfillmentModal: React.FC<PartialFulfillmentModalProps> = ({
  isOpen,
  onClose,
  order,
  type,
  onSubmit
}) => {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (order && order.lines) {
      setItems(order.lines.map((line: any) => ({
        productId: line.productId,
        productName: line.product?.name || line.itemDescription,
        orderedQty: line.quantity,
        fulfilledQty: type === 'DN' ? (line.deliveredQuantity || 0) : (line.receivedQuantity || 0),
        currentQty: 0
      })));
    }
  }, [order, type]);

  if (!isOpen) return null;

  const handleQtyChange = (productId: string, val: string) => {
    const qty = parseInt(val) || 0;
    setItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const remaining = item.orderedQty - item.fulfilledQty;
        if (qty > remaining) {
          toast.error(`Cannot exceed remaining quantity (${remaining})`);
          return { ...item, currentQty: remaining };
        }
        return { ...item, currentQty: qty };
      }
      return item;
    }));
  };

  const handleFullFulfillment = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      currentQty: item.orderedQty - item.fulfilledQty
    })));
  };

  const handleSubmit = () => {
    const fulfillmentItems = items.filter(item => item.currentQty > 0).map(item => ({
      productId: item.productId,
      quantity: item.currentQty
    }));

    if (fulfillmentItems.length === 0) {
      toast.error('Please specify quantity for at least one item');
      return;
    }

    onSubmit(fulfillmentItems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800">
            Generate {type === 'DN' ? 'Delivery Note' : 'Goods Receipt Note'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-500">
              Select quantities for partial {type === 'DN' ? 'delivery' : 'receipt'}.
            </p>
            <button 
              onClick={handleFullFulfillment}
              className="px-3 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
            >
              Fill Remaining
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-center">Ordered</th>
                  <th className="px-4 py-3 text-center">Already {type === 'DN' ? 'Shipped' : 'Received'}</th>
                  <th className="px-4 py-3 text-center">Remaining</th>
                  <th className="px-4 py-3 w-32 text-center">Current {type === 'DN' ? 'Ship' : 'Receive'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.productId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{item.orderedQty}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{item.fulfilledQty}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{item.orderedQty - item.fulfilledQty}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={item.orderedQty - item.fulfilledQty}
                        value={item.currentQty}
                        onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                        className="w-full text-center border border-gray-200 rounded px-2 py-1 focus:border-indigo-500 focus:ring-0 outline-none text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Generate {type}
          </button>
        </div>
      </div>
    </div>
  );
};
