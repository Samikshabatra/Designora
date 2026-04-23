import React, { useState } from 'react';
import { User } from '../types';

interface PricingProps {
  onSelectPlan: () => void;
  user?: User | null;
  setUser?: React.Dispatch<React.SetStateAction<User | null>>;
  onLoginClick?: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

declare global {
  interface Window { Razorpay: any; }
}

const Pricing: React.FC<PricingProps> = ({ onSelectPlan, user, setUser, onLoginClick }) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const plans = [
    {
      tier: 'Free',
      monthlyPrice: 0,
      annualPrice: 0,
      displayMonthly: '₹0',
      displayAnnual: '₹0',
      period: 'forever',
      credits: 10,
      creditsLabel: '10',
      features: [
        '10 AI design generations',
        'All 8 design styles',
        'Budget breakdown',
        'Shopping links',
        'Standard resolution',
      ],
      cta: 'Get Started',
      highlight: false,
    },
    {
      tier: 'Pro',
      monthlyPrice: 499,
      annualPrice: 399,
      displayMonthly: '₹499',
      displayAnnual: '₹399',
      period: 'per month',
      credits: 100,
      creditsLabel: '100',
      features: [
        '100 AI design generations / mo',
        'All 8 design styles',
        'Before & After comparison',
        'High-resolution outputs',
        'Budget breakdown & sourcing',
        'Priority generation queue',
      ],
      cta: 'Start Pro',
      highlight: true,
    },
    {
      tier: 'Enterprise',
      monthlyPrice: 1999,
      annualPrice: 1599,
      displayMonthly: '₹1,999',
      displayAnnual: '₹1,599',
      period: 'per month',
      credits: 500,
      creditsLabel: 'Unlimited',
      features: [
        'Unlimited AI generations',
        'All 8 design styles',
        'API access',
        'Custom model fine-tuning',
        'White-label exports',
        'Dedicated support',
      ],
      cta: 'Contact Sales',
      highlight: false,
    },
  ];

  const handleSelectPlan = async (plan: typeof plans[0]) => {
    // Free plan — just go to dashboard
    if (plan.tier === 'Free') {
      onSelectPlan();
      return;
    }

    // Must be logged in to purchase
    if (!user || !user.token) {
      onLoginClick?.();
      return;
    }

    const amount = isAnnual ? plan.annualPrice : plan.monthlyPrice;

    setLoadingPlan(plan.tier);
    setSuccessMsg(null);

    try {
      // 1. Create order on backend
      const orderRes = await fetch(`${API_BASE}/api/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          plan: plan.tier,
          amount: amount,
          credits: plan.credits,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

      // 2. Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Designora',
        description: `${plan.tier} Plan — ${plan.credits} credits`,
        order_id: orderData.orderId,
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: '#000000',
        },
        handler: async (response: any) => {
          // 3. Verify payment on backend
          try {
            const verifyRes = await fetch(`${API_BASE}/api/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                credits: plan.credits,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');

            // 4. Update user credits in frontend
            setUser?.(prev => prev ? { ...prev, credits: verifyData.credits } : null);
            setSuccessMsg(`Payment successful! ${plan.credits} credits added to your account.`);

            // Navigate to dashboard after 2 seconds
            setTimeout(() => {
              setSuccessMsg(null);
              onSelectPlan();
            }, 2500);
          } catch (err: any) {
            alert('Payment verification failed: ' + err.message);
          }
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        alert('Payment failed: ' + (response.error?.description || 'Unknown error'));
        setLoadingPlan(null);
      });
      rzp.open();
      setLoadingPlan(null);

    } catch (err: any) {
      alert('Error: ' + err.message);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="py-24 px-6 bg-white dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-4 transition-colors">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 font-medium transition-colors">
            Start free. Upgrade when you need more power.
          </p>

          {/* Success message */}
          {successMsg && (
            <div className="mt-6 inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-bold px-6 py-3 rounded-2xl animate-scale-in">
              ✅ {successMsg}
            </div>
          )}

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 mt-8 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl transition-colors">
            <button
              onClick={() => setIsAnnual(false)}
              className={`text-sm font-black px-5 py-2 rounded-xl transition-all ${
                !isAnnual
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`text-sm font-black px-5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                isAnnual
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Annual
              <span className="bg-black dark:bg-white text-white dark:text-black text-xs font-black px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => {
            const displayPrice = isAnnual ? plan.displayAnnual : plan.displayMonthly;
            const period = plan.tier === 'Free' ? plan.period : isAnnual ? 'per month, billed annually' : plan.period;
            const isLoading = loadingPlan === plan.tier;

            return (
              <div
                key={plan.tier}
                className={`rounded-2xl p-8 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${plan.highlight
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-2xl dark:shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-105 hover:scale-[1.07]'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-black dark:hover:border-slate-600'
                  }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-black tracking-widest text-black dark:text-white bg-white dark:bg-black px-3 py-1 rounded-full inline-block mb-4 transition-colors">
                    ✦ MOST POPULAR
                  </div>
                )}
                <h2 className={`text-2xl font-black mb-1 tracking-tight transition-colors ${plan.highlight ? 'text-white dark:text-black' : 'text-slate-900 dark:text-white'}`}>
                  {plan.tier}
                </h2>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-4xl font-black transition-colors ${plan.highlight ? 'text-white dark:text-black' : 'text-slate-900 dark:text-white'}`}>
                    {displayPrice}
                  </span>
                  <span className={`text-sm font-medium transition-colors ${plan.highlight ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500'}`}>
                    /{period}
                  </span>
                </div>
                {isAnnual && plan.tier !== 'Free' && (
                  <p className={`text-xs font-bold mb-1 transition-colors ${plan.highlight ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500'}`}>
                    was {plan.displayMonthly}/mo
                  </p>
                )}
                <p className={`text-sm font-bold mb-6 transition-colors ${plan.highlight ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
                  {plan.creditsLabel} credits
                </p>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={`text-sm font-medium flex items-center gap-2 transition-colors ${plan.highlight ? 'text-slate-200 dark:text-slate-700' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      <span className={`transition-colors ${plan.highlight ? 'text-white dark:text-black' : 'text-black dark:text-white'}`}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isLoading}
                  className={`w-full py-4 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${plan.highlight
                    ? 'bg-white dark:bg-black text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'bg-black dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200'
                    }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </span>
                  ) : plan.cta}
                </button>

                {plan.tier !== 'Free' && (
                  <p className={`text-center text-[10px] font-medium mt-3 transition-colors ${plan.highlight ? 'text-slate-400 dark:text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>
                    🔒 Secured by Razorpay • UPI, Cards, Wallets accepted
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-slate-400 font-medium mt-10 transition-colors duration-300">
          All plans include access to Replicate-powered AI models.
          Prices in INR. Test mode — no real money charged.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
