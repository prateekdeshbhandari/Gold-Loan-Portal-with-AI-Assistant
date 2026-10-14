import React, { useState, useEffect, useRef } from 'react';
import {
  Coins,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calculator,
  ShieldCheck,
  FileText,
  Clock,
  Percent,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../api/apiClient';

export default function BorrowerForm() {
  const [step, setStep] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    grossWeightGrams: '',
    netWeightGrams: '',
    karat: 22,
    planId: 'PLAN_EMI_01'
  });

  // Validation Errors
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);

  // Live Quote Calculation State
  const [quote, setQuote] = useState(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const debounceTimerRef = useRef(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [copied, setCopied] = useState(false);

  // Inline Validation Function
  const validateField = (name, value, currentForm = formData) => {
    let err = '';
    const form = { ...currentForm, [name]: value };

    if (name === 'fullName') {
      if (!value.trim()) {
        err = 'Full name is required';
      } else if (value.trim().length < 2 || value.trim().length > 60) {
        err = 'Name must be 2–60 characters';
      } else if (!/^[a-zA-Z\s]+$/.test(value)) {
        err = 'Letters and spaces only';
      }
    }

    if (name === 'mobileNumber') {
      if (!value.trim()) {
        err = 'Mobile number is required';
      } else if (!/^[6-9]\d{9}$/.test(value.trim())) {
        err = '10-digit Indian number starting with 6, 7, 8, or 9';
      }
    }

    if (name === 'grossWeightGrams') {
      const num = parseFloat(value);
      if (!value || isNaN(num) || num <= 0) {
        err = 'Gross weight must be greater than 0';
      } else if (num > 1000) {
        err = 'Gross weight cannot exceed 1000g';
      }
    }

    if (name === 'netWeightGrams') {
      const net = parseFloat(value);
      const gross = parseFloat(form.grossWeightGrams);
      if (!value || isNaN(net) || net <= 0) {
        err = 'Net weight must be greater than 0';
      } else if (net > 1000) {
        err = 'Net weight cannot exceed 1000g';
      } else if (!isNaN(gross) && net > gross) {
        err = 'Net weight cannot exceed gross weight';
      }
    }

    return err;
  };

  // Handle Input Changes with Instant Inline Validation
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...formData, [name]: value };
    setFormData(updatedForm);

    const errorMsg = validateField(name, value, updatedForm);
    setErrors((prev) => ({ ...prev, [name]: errorMsg }));

    // Re-validate cross-field relation if gross weight changes
    if (name === 'grossWeightGrams' && updatedForm.netWeightGrams) {
      const netErr = validateField('netWeightGrams', updatedForm.netWeightGrams, updatedForm);
      setErrors((prev) => ({ ...prev, netWeightGrams: netErr }));
    }
  };

  // Debounced Live Quote calculation (~300ms)
  useEffect(() => {
    const gross = parseFloat(formData.grossWeightGrams);
    const net = parseFloat(formData.netWeightGrams);
    const karat = parseInt(formData.karat, 10);

    // Only quote if valid weights are entered
    if (gross > 0 && net > 0 && net <= gross && [18, 22, 24].includes(karat)) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      setIsQuoting(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await api.calculateQuote({
            grossWeightGrams: gross,
            netWeightGrams: net,
            karat
          });
          setQuote(res);
          setIsQuoting(false);
        } catch (err) {
          console.error('Quote error:', err);
          setIsQuoting(false);
        }
      }, 300);
    } else {
      setQuote(null);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [formData.grossWeightGrams, formData.netWeightGrams, formData.karat]);

  // Validate current step before moving forward
  const canProceedToStep2 = () => {
    const nameErr = validateField('fullName', formData.fullName);
    const mobileErr = validateField('mobileNumber', formData.mobileNumber);
    const grossErr = validateField('grossWeightGrams', formData.grossWeightGrams);
    const netErr = validateField('netWeightGrams', formData.netWeightGrams);

    const newErrors = {
      fullName: nameErr,
      mobileNumber: mobileErr,
      grossWeightGrams: grossErr,
      netWeightGrams: netErr
    };

    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const handleNext = () => {
    setApiError(null);
    if (step === 1) {
      if (canProceedToStep2()) setStep(2);
    } else if (step === 2) {
      if (!formData.planId) {
        setApiError('Please select a loan scheme to continue');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setApiError(null);
    if (step > 1) setStep(step - 1);
  };

  // Submit Lead
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setApiError(null);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        grossWeightGrams: parseFloat(formData.grossWeightGrams),
        netWeightGrams: parseFloat(formData.netWeightGrams),
        karat: parseInt(formData.karat, 10),
        planId: formData.planId
      };

      const res = await api.submitLead(payload);
      setSubmissionSuccess(res);
      setStep(4); // Success screen
    } catch (err) {
      console.error('Submission failed:', err);

      // Friendly 409 handling as per requirements:
      // "A 409 becomes 'You already applied on 3 Oct, application GL-1042', not 'Error 409'"
      if (err.status === 409 || err.code === 'DUPLICATE_APPLICATION') {
        setApiError(err.message || 'You have already applied within the last 7 days. Please wait before reapplying.');
      } else if (err.fields && err.fields.length > 0) {
        const fieldErrorMap = {};
        err.fields.forEach((f) => {
          fieldErrorMap[f.field] = f.message;
        });
        setErrors((prev) => ({ ...prev, ...fieldErrorMap }));
        setApiError('Please correct the highlighted fields before submitting.');
      } else {
        setApiError(err.message || 'Failed to submit application. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyAppId = () => {
    if (submissionSuccess?.applicationId) {
      navigator.clipboard.writeText(submissionSuccess.applicationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      mobileNumber: '',
      grossWeightGrams: '',
      netWeightGrams: '',
      karat: 22,
      planId: 'PLAN_EMI_01'
    });
    setErrors({});
    setApiError(null);
    setQuote(null);
    setSubmissionSuccess(null);
    setStep(1);
  };

  const selectedPlanQuote = quote?.plans?.find((p) => p.planId === formData.planId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Step Stepper Header */}
      {step < 4 && (
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 w-full z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-amber-500 transition-all duration-300 z-0"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />

            {[
              { num: 1, label: 'Gold Details' },
              { num: 2, label: 'Live Quote' },
              { num: 3, label: 'Confirm & Apply' }
            ].map((s) => (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                    step === s.num
                      ? 'bg-amber-600 text-white ring-4 ring-amber-100 shadow'
                      : step > s.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border-2 border-slate-300 text-slate-500'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
                </div>
                <span className={`text-xs mt-2 font-medium ${step >= s.num ? 'text-slate-900' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Card Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Error Alert Banner */}
        {apiError && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-start space-x-3 text-rose-800 animate-fadeIn">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Action Required</p>
              <p className="mt-0.5">{apiError}</p>
            </div>
          </div>
        )}

        {/* STEP 1: Gold & Borrower Details */}
        {step === 1 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span>Borrower & Jewellery Details</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your details to calculate the maximum loan eligibility.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                    errors.fullName
                      ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/30'
                      : 'border-slate-300 focus:ring-amber-200 focus:border-amber-500'
                  }`}
                />
                {errors.fullName && <p className="text-xs text-rose-600 mt-1">{errors.fullName}</p>}
              </div>

              {/* Mobile Number */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Indian Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm font-semibold">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength="10"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleChange}
                    placeholder="9876543210"
                    className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm font-mono tracking-wider transition-all focus:outline-none focus:ring-2 ${
                      errors.mobileNumber
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/30'
                        : 'border-slate-300 focus:ring-amber-200 focus:border-amber-500'
                    }`}
                  />
                </div>
                {errors.mobileNumber && <p className="text-xs text-rose-600 mt-1">{errors.mobileNumber}</p>}
                <p className="text-[11px] text-slate-400 mt-1">10-digit number starting with 6, 7, 8, or 9.</p>
              </div>

              {/* Gross Weight */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Gross Weight (Grams) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    name="grossWeightGrams"
                    value={formData.grossWeightGrams}
                    onChange={handleChange}
                    placeholder="e.g. 50"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                      errors.grossWeightGrams
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/30'
                        : 'border-slate-300 focus:ring-amber-200 focus:border-amber-500'
                    }`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                    g
                  </span>
                </div>
                {errors.grossWeightGrams && (
                  <p className="text-xs text-rose-600 mt-1">{errors.grossWeightGrams}</p>
                )}
              </div>

              {/* Net Weight */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Net Gold Weight (Grams) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    name="netWeightGrams"
                    value={formData.netWeightGrams}
                    onChange={handleChange}
                    placeholder="e.g. 45"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                      errors.netWeightGrams
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/30'
                        : 'border-slate-300 focus:ring-amber-200 focus:border-amber-500'
                    }`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                    g
                  </span>
                </div>
                {errors.netWeightGrams && <p className="text-xs text-rose-600 mt-1">{errors.netWeightGrams}</p>}
                <p className="text-[11px] text-slate-400 mt-1">Excludes stones, pearls, and wax.</p>
              </div>

              {/* Karat Selector */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Gold Purity (Karat) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { karat: 18, label: '18 Karat', purity: '75.0% Pure' },
                    { karat: 22, label: '22 Karat', purity: '91.67% Pure' },
                    { karat: 24, label: '24 Karat', purity: '99.9% Pure' }
                  ].map((k) => (
                    <button
                      key={k.karat}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, karat: k.karat }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        formData.karat === k.karat
                          ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-300'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-900">{k.label}</div>
                      <div className="text-xs text-amber-700 font-medium mt-0.5">{k.purity}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Live Preview Snippet */}
            {quote && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-between text-xs sm:text-sm animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="font-medium text-slate-700">
                    Pure Gold: <strong className="text-slate-900">{quote.pureGoldGrams}g</strong> · Valuation: <strong className="text-slate-900">₹{quote.goldValue.toLocaleString('en-IN')}</strong>
                  </span>
                </div>
                <span className="font-bold text-amber-800 text-xs px-2 py-0.5 rounded bg-amber-100">
                  Live Computed
                </span>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleNext}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-md shadow-amber-600/20 transition-all"
              >
                <span>Calculate & Compare Schemes</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Live Quote & Scheme Selector */}
        {step === 2 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-amber-500" />
                <span>Live Valuation & Loan Offers</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Select your preferred loan repayment scheme below.
              </p>
            </div>

            {/* Pure Gold & Valuation Card */}
            {quote && (
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200">
                <div>
                  <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">
                    Calculated Pure Gold
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                    {quote.pureGoldGrams} <span className="text-sm font-semibold text-slate-600">grams</span>
                  </span>
                  <span className="text-[11px] text-amber-700/80 mt-0.5 block">
                    {formData.netWeightGrams}g × ({formData.karat}/24)
                  </span>
                </div>

                <div>
                  <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">
                    Market Gold Valuation
                  </span>
                  <span className="text-2xl font-extrabold text-amber-950 mt-1 block">
                    ₹{quote.goldValue.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-amber-700/80 mt-0.5 block">
                    @ ₹7,000 / g 24K
                  </span>
                </div>
              </div>
            )}

            {/* Scheme Cards (Selectable) */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Select Loan Plan (Re-calculated Server-Side)
              </label>

              {quote?.plans?.map((plan) => {
                const isSelected = formData.planId === plan.planId;
                return (
                  <div
                    key={plan.planId}
                    onClick={() => setFormData((prev) => ({ ...prev, planId: plan.planId }))}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-1 ring-amber-300'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-slate-900 text-base">{plan.name}</h3>
                          {isSelected && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-600 text-white px-2 py-0.5 rounded-full">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{plan.tenure}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Eligible Loan</span>
                        <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                          ₹{plan.eligibleLoan.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        <Percent className="w-3.5 h-3.5 text-amber-600" />
                        <span>Interest: <strong>{plan.annualInterestRate}% p.a.</strong></span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Max LTV: <strong>{Math.round(plan.maxLtv * 100)}%</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handleBack}
                className="w-1/3 flex items-center justify-center space-x-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="w-2/3 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-md shadow-amber-600/20 transition-all"
              >
                <span>Review Application</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Confirm & Submit */}
        {step === 3 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <span>Review & Submit Application</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Verify your information before filing the loan application.
              </p>
            </div>

            {/* Summary Review Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 text-sm">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Applicant</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{formData.fullName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Mobile Number</span>
                  <span className="font-bold text-slate-900 font-mono mt-0.5 block">+91 {formData.mobileNumber}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pb-4 border-b border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Gross Weight</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{formData.grossWeightGrams} g</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Net Weight</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{formData.netWeightGrams} g</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Purity</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{formData.karat} Karat</span>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Selected Scheme</span>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      {selectedPlanQuote?.name || formData.planId}
                    </span>
                    <span className="text-xs text-slate-500">
                      {selectedPlanQuote?.annualInterestRate}% p.a. · {selectedPlanQuote?.tenure}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Max Sanction</span>
                    <span className="text-xl font-extrabold text-emerald-700 block">
                      ₹{selectedPlanQuote?.eligibleLoan.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Regulatory Notice */}
            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <p>
                As per regulatory directives, final loan disbursal is capped at 75% LTV after physical purity appraisal
                at your nearest partner branch.
              </p>
            </div>

            {/* Navigation & Submit Buttons */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="w-1/3 flex items-center justify-center space-x-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-all disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-2/3 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 transition-all disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Submit Lead</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Success Screen */}
        {step === 4 && submissionSuccess && (
          <div className="p-8 text-center space-y-6 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Application Submitted Successfully
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900 mt-3">
                Your Gold Loan Lead is Created!
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                A verification officer will contact you within 2 business hours for doorstep appraisal.
              </p>
            </div>

            {/* Application ID Card with 1-Click Copy */}
            <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-5 max-w-sm mx-auto shadow-inner">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">
                Official Application ID
              </span>
              <div className="flex items-center justify-center space-x-2 mt-1">
                <span className="text-3xl font-mono font-extrabold text-amber-950 tracking-wider">
                  {submissionSuccess.applicationId}
                </span>
                <button
                  onClick={copyAppId}
                  className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-200 transition-colors"
                  title="Copy Application ID"
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <span className="text-[11px] text-amber-700 mt-1 block">
                Status: <strong>SUBMITTED</strong> · Quoted Loan: <strong>₹{submissionSuccess.lead?.eligibleLoan?.toLocaleString('en-IN')}</strong>
              </span>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-all"
              >
                Submit Another Application
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
