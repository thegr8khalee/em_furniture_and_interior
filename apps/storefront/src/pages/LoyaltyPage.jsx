import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoyaltyStore } from '../store/useLoyaltyStore';
import { Trophy, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { PageWrapper } from '../components/animations';
import SEO from '../components/SEO';

const LoyaltyPage = () => {
  const navigate = useNavigate();
  const { authUser, isCheckingAuth: isAuthLoading } = useAuthStore();
  const { summary, history, isLoading, getSummary, getHistory } = useLoyaltyStore();

  useEffect(() => {
    if (!isAuthLoading && !authUser) {
      navigate('/login');
      return;
    }

    if (authUser) {
      getSummary();
      getHistory();
    }
  }, [getSummary, getHistory, authUser, isAuthLoading, navigate]);

  if (isLoading && !summary) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <PageWrapper>
    <SEO title="Loyalty Rewards" description="Your loyalty rewards and points." canonical="/loyalty" noindex />
    <div className="min-h-screen bg-base-100 pt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Trophy size={32} className="text-secondary" />
          <div>
            <h1 className="text-3xl font-bold text-neutral">Loyalty Points</h1>
            <p className="text-neutral/60 mt-1">Earn points with every order</p>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="card bg-white border border-base-300">
              <div className="card-body">
                <p className="text-sm text-neutral/60">Current Balance</p>
                <p className="text-2xl font-bold text-neutral">{summary.balance}</p>
              </div>
            </div>
            <div className="card bg-white border border-base-300">
              <div className="card-body">
                <p className="text-sm text-neutral/60">Total Earned</p>
                <p className="text-2xl font-bold text-neutral">{summary.totalEarned}</p>
              </div>
            </div>
            <div className="card bg-white border border-base-300">
              <div className="card-body">
                <p className="text-sm text-neutral/60">Total Redeemed</p>
                <p className="text-2xl font-bold text-neutral">{summary.totalRedeemed}</p>
              </div>
            </div>
          </div>
        )}

        <div className="card bg-white border border-base-300">
          <div className="card-body">
            <h2 className="text-xl font-semibold mb-4">Points History</h2>
            {history.length === 0 ? (
              <p className="text-neutral/60">No loyalty transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Points</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item._id}>
                        <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td className="capitalize">{item.type}</td>
                        <td className={item.type === 'redeem' ? 'text-error' : 'text-success'}>
                          {item.type === 'redeem' ? '-' : '+'}{item.points}
                        </td>
                        <td>{item.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </PageWrapper>
  );
};

export default LoyaltyPage;
