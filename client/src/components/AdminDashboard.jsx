import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  RefreshCw,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Coins,
  Calendar
} from 'lucide-react';
import { api } from '../api/apiClient';

export default function AdminDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Status Update & Audit Modal State
  const [activeLead, setActiveLead] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLeads({
        planId: selectedPlan,
        status: selectedStatus
      });
      setLeads(res.leads || []);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
      setError('Could not load leads. Please verify the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [selectedPlan, selectedStatus]);

  const handleOpenStatusModal = (lead) => {
    setActiveLead(lead);
    setNewStatus(lead.status);
    setStatusNotes('');
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!activeLead) return;

    setUpdating(true);
    try {
      await api.updateLeadStatus(activeLead.applicationId, {
        status: newStatus,
        notes: statusNotes
      });
      setActiveLead(null);
      await fetchLeads();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert(err.message || 'Error updating status');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            <span>APPROVED</span>
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3" />
            <span>UNDER REVIEW</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3" />
            <span>REJECTED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <FileText className="w-3 h-3" />
            <span>SUBMITTED</span>
          </span>
        );
    }
  };

  // Metrics Summary
  const totalLeads = leads.length;
  const totalLoanValue = leads.reduce((acc, curr) => acc + (curr.eligibleLoan || 0), 0);
  const totalWeight = leads.reduce((acc, curr) => acc + (curr.netWeightGrams || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <UserCheck className="w-6 h-6 text-amber-600" />
            <span>Field Agent & Intake Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review gold loan leads, verify masked applicant contacts, and update appraisal status.
          </p>
        </div>

        <button
          onClick={fetchLeads}
          disabled={loading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-xs transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          <span>Refresh Leads</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Applications
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{totalLeads}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Loan Pipeline
            </span>
            <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
              ₹{totalLoanValue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Net Gold Weight
            </span>
            <span className="text-2xl font-extrabold text-amber-900 mt-1 block">
              {totalWeight.toFixed(1)} <span className="text-sm font-semibold text-slate-500">grams</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
          <Filter className="w-4 h-4 text-amber-600" />
          <span>Filters:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Plan Filter */}
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-200"
          >
            <option value="">All Loan Plans</option>
            <option value="PLAN_EMI_01">Monthly EMI (75% LTV)</option>
            <option value="PLAN_BULLET_01">Bullet Repayment (70% LTV)</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-200"
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600" />
            <p className="text-sm">Loading applications...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <ShieldAlert className="w-6 h-6 mx-auto" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-semibold">No applications found</p>
            <p className="text-xs">Submit a new lead from the application form or AI assistant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-4 py-3.5">App ID</th>
                  <th className="px-4 py-3.5">Applicant</th>
                  <th className="px-4 py-3.5">Masked Mobile</th>
                  <th className="px-4 py-3.5">Gold Specs</th>
                  <th className="px-4 py-3.5">Scheme</th>
                  <th className="px-4 py-3.5">Quoted Loan</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {leads.map((lead) => (
                  <tr key={lead.applicationId} className="hover:bg-slate-50/80 transition-colors">
                    {/* App ID */}
                    <td className="px-4 py-3 font-mono font-bold text-amber-900 whitespace-nowrap">
                      {lead.applicationId}
                    </td>

                    {/* Full Name */}
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {lead.fullName}
                    </td>

                    {/* Masked Mobile (9876XXXX10) */}
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {lead.mobileNumber}
                    </td>

                    {/* Gold Specs */}
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      <div>
                        <strong>{lead.netWeightGrams}g</strong> ({lead.karat}K)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Gross: {lead.grossWeightGrams}g · Pure: {lead.pureGoldGrams}g
                      </div>
                    </td>

                    {/* Scheme */}
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      <span className="font-semibold block">{lead.planName}</span>
                      <span className="text-[11px] text-slate-400">{lead.annualInterestRate}% p.a.</span>
                    </td>

                    {/* Quoted Loan */}
                    <td className="px-4 py-3 font-extrabold text-emerald-700 whitespace-nowrap">
                      ₹{lead.eligibleLoan?.toLocaleString('en-IN')}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(lead.status)}</td>

                    {/* Date */}
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>

                    {/* Action Button */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenStatusModal(lead)}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 hover:border-amber-500 hover:bg-amber-50 text-slate-700 text-xs font-semibold transition-all"
                      >
                        Workflow
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status Workflow & Audit Log Modal */}
      {activeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Application Workflow: {activeLead.applicationId}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Applicant: {activeLead.fullName} ({activeLead.mobileNumber})
                </p>
              </div>
              <button
                onClick={() => setActiveLead(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Update Lead Status (SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED)
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Audit Notes / Reason
                </label>
                <textarea
                  rows="2"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="e.g. In-person jewellery purity verified at branch, KYC passed."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>

              {/* Audit Log History */}
              {activeLead.auditLog && activeLead.auditLog.length > 0 && (
                <div>
                  <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Audit Trail History
                  </span>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-2 text-xs">
                    {activeLead.auditLog.map((log, lIdx) => (
                      <div key={lIdx} className="pb-2 border-b border-slate-200/60 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {log.fromStatus} → {log.toStatus}
                          </span>
                          <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {log.notes && <p className="text-slate-600 mt-0.5">{log.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveLead(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
