import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import { useCartStore } from '../store/useCartStore';
import { PageWrapper } from '../components/animations';
import SEO from '../components/SEO';

const PaymentVerify = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your payment...');
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const params = new URLSearchParams(location.search);
      const reference = params.get('reference');
      const txRef = params.get('tx_ref');
      const sessionId = params.get('session_id');

      if (!reference && !txRef && !sessionId) {
        setStatus('failed');
        setMessage('Missing payment reference.');
        return;
      }

      try {
        let response;

        if (sessionId) {
          response = await axiosInstance.get(`/payments/stripe/verify?session_id=${sessionId}`);
        } else if (txRef) {
          response = await axiosInstance.get(`/payments/flutterwave/verify?tx_ref=${txRef}`);
        } else {
          response = await axiosInstance.get(`/payments/paystack/verify?reference=${reference}`);
        }

        if (response.data?.status === 'success') {
          setStatus('success');
          setMessage('Payment successful! Redirecting to your order...');
          setOrderId(response.data.orderId);

          // Clear cart after confirmed payment
          const { clearCart } = useCartStore.getState();
          await clearCart();

          setTimeout(() => {
            if (response.data.orderId) {
              navigate(`/order-confirmation/${response.data.orderId}`);
            }
          }, 2000);
        } else {
          setStatus('failed');
          setMessage('Payment verification failed. Please contact support.');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('failed');
        setMessage(error.response?.data?.message || 'Payment verification failed.');
      }
    };

    verifyPayment();
  }, [location.search, navigate]);

  return (
    <PageWrapper>
    <SEO title="Payment Verification" description="Verifying your payment." noindex />
    <div className="min-h-screen flex items-center justify-center bg-base-100 pt-20">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
        {status === 'verifying' && (
          <>
            <Loader2 className="animate-spin mx-auto mb-4" size={48} />
            <h2 className="text-xl font-semibold mb-2">Verifying Payment</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="text-success mx-auto mb-4" size={48} />
            <h2 className="text-xl font-semibold mb-2">Payment Successful</h2>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="text-error mx-auto mb-4" size={48} />
            <h2 className="text-xl font-semibold mb-2">Payment Failed</h2>
          </>
        )}
        <p className="text-neutral/70 mb-4">{message}</p>
        {status === 'failed' && (
          <button
            className="btn btn-primary"
            onClick={() => navigate('/shop')}
          >
            Continue Shopping
          </button>
        )}
        {status === 'success' && orderId && (
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/order-confirmation/${orderId}`)}
          >
            View Order
          </button>
        )}
      </div>
    </div>
    </PageWrapper>
  );
};

export default PaymentVerify;
