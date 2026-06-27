import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield, LogOut, Users, Package, ShoppingCart, TrendingUp, Menu,
  BarChart3, AlertCircle, CheckCircle, Clock, XCircle, Truck,
  Activity, Server, Database, ArrowRight, ArrowUpRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import krLogo from "@/assets/kr-fireworks-logo.png";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  paidOrders: number;
}

interface OrderStats {
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

interface InventoryAlert {
  id: string;
  name: string;
  stock: number;
}

interface SalesData {
  name: string;
  total: number;
}

interface Order {
  id: string;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    paidOrders: 0
  });
  const [orderStats, setOrderStats] = useState<OrderStats>({
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  });
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlert[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [salesRange, setSalesRange] = useState<'today' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  // Interaction State
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  useEffect(() => {
    checkAdminAuth();
    fetchDashboardStats();
  }, [navigate]); // Re-fetch when navigating back

  // Add effect to re-fetch sales data when range changes
  useEffect(() => {
    if (!loading) { // Avoid initial double fetch
      fetchSalesDataOnly();
    }
  }, [salesRange]);

  const handleStatusChange = async () => {
    if (!orderToUpdate || !newStatus) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderToUpdate);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully.",
      });

      // Update local state
      setRecentOrders(prev => prev.map(o => o.id === orderToUpdate ? { ...o, status: newStatus } : o));
      setIsStatusDialogOpen(false);

      // Refresh stats
      fetchDashboardStats();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const openStatusDialog = (orderId: string, currentStatus: string) => {
    setOrderToUpdate(orderId);
    setNewStatus(currentStatus);
    setIsStatusDialogOpen(true);
  };

  const viewOrderDetails = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*') // key items should be in JSONB or relational table
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setSelectedOrder(data);
      setIsOrderDialogOpen(true);
    } catch (e) {
      toast({ title: "Error", description: "Could not load order details", variant: "destructive" });
    }
  };


  const checkAdminAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate('/admin');
      return;
    }

    // Verify user is admin
    const { data: isAdminData } = await supabase.rpc('is_admin', {
      _user_id: session.user.id
    });

    if (!isAdminData) {
      await supabase.auth.signOut();
      navigate('/admin');
      return;
    }

    // Get admin details
    const { data: adminDetails } = await supabase
      .from('admin')
      .select('username, email')
      .eq('user_id', session.user.id)
      .maybeSingle();

    setAdminUser({
      id: session.user.id,
      username: adminDetails?.username || 'Admin',
      email: adminDetails?.email || session.user.email
    });
  };

  const fetchSalesDataOnly = async () => {
    try {
      const now = new Date();
      let startDate = new Date();

      // Reset to start of the day in local time for consistent calculations
      startDate.setHours(0, 0, 0, 0);

      if (salesRange === 'today') {
        // Start date is already today 00:00
      } else if (salesRange === 'week') {
        // Go back 6 days to include today (7 days total)
        startDate.setDate(now.getDate() - 6);
      } else if (salesRange === 'month') {
        // Go back 29 days to include today (30 days total)
        startDate.setDate(now.getDate() - 29);
      }

      // Query Supabase using ISO string of the calculated local start date
      // Note: Supabase stores in UTC, so we might miss a few hours if the server is ahead/behind significantly
      // without proper offset handling, but strictly gte current local start converted to UTC works for "history".
      // Ideally, we want created_at >= StartOfDayUTC. 
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .gte('created_at', startDate.toISOString())
        .neq('status', 'cancelled'); // Exclude cancelled orders

      if (error) throw error;

      // Process Data
      let chartMap = new Map<string, number>();

      if (salesRange === 'today') {
        // Initialize 24 hourly buckets for today (00:00 to 23:00)
        for (let i = 0; i < 24; i++) {
          const hours = i.toString().padStart(2, '0');
          chartMap.set(`${hours}:00`, 0);
        }

        ordersData?.forEach(order => {
          const orderDate = new Date(order.created_at);
          // Check if order is actually from "today" in local time
          if (orderDate.toDateString() === now.toDateString()) {
            const hour = orderDate.getHours().toString().padStart(2, '0');
            const key = `${hour}:00`;
            chartMap.set(key, (chartMap.get(key) || 0) + (Number(order.total_amount) || 0));
          }
        });
      } else {
        // Daily buckets for week/month
        // Initialize buckets with 0 to ensure continuity in the chart
        const days = salesRange === 'week' ? 7 : 30;
        // Clone startDate so we don't modify the original reference while iterating
        let currentDay = new Date(startDate);

        for (let i = 0; i < days; i++) {
          // Format based on local time: YYYY-MM-DD
          const year = currentDay.getFullYear();
          const month = (currentDay.getMonth() + 1).toString().padStart(2, '0');
          const day = currentDay.getDate().toString().padStart(2, '0');
          const key = `${year}-${month}-${day}`;

          chartMap.set(key, 0);

          // Move to next day
          currentDay.setDate(currentDay.getDate() + 1);
        }

        ordersData?.forEach(order => {
          const orderDate = new Date(order.created_at);
          const year = orderDate.getFullYear();
          const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
          const day = orderDate.getDate().toString().padStart(2, '0');
          const key = `${year}-${month}-${day}`;

          if (chartMap.has(key)) {
            chartMap.set(key, (chartMap.get(key) || 0) + (Number(order.total_amount) || 0));
          }
        });
      }

      const chartData = Array.from(chartMap.entries()).map(([key, total]) => {
        if (salesRange === 'today') return { name: key, total };

        // Format date for display (e.g., "Jan 01")
        const [year, month, day] = key.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        return {
          name: dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
          total
        };
      });

      setSalesData(chartData);

    } catch (error) {
      console.error("Error fetching sales data:", error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // 1. Fetch Basic Totals
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (usersError) console.error("Error fetching users count:", usersError);

      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      if (productsError) console.error("Error fetching products count:", productsError);

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, status, created_at');
      if (ordersError) throw ordersError;

      const ordersCount = ordersData?.length || 0;

      // Calculate Revenue Metrics (Excluding Cancelled)
      const validOrders = ordersData?.filter(o => o.status !== 'cancelled') || [];
      const totalRevenue = validOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayRevenue = validOrders
        .filter(o => o.created_at.startsWith(todayStr))
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

      const monthRevenue = validOrders
        .filter(o => new Date(o.created_at) >= monthStart)
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

      // Calculate Paid Orders (Assuming Shipped, Delivered, Completed are paid/guaranteed)
      // Note: 'processing' could be COD, so strictly 'paid' usually implies money received. 
      // Adjusting based on common e-com flows: Completed + Delivered + Shipped often implies confirmed/paid or committed.
      const paidOrdersCount = ordersData?.filter(o =>
        ['delivered', 'shipped', 'completed'].includes(o.status?.toLowerCase())
      ).length || 0;

      setStats({
        totalUsers: usersCount || 0,
        totalOrders: ordersCount,
        totalProducts: productsCount || 0,
        totalRevenue,
        todayRevenue,
        monthRevenue,
        paidOrders: paidOrdersCount
      });

      // 2. Process Order Stats
      const newOrderStats = {
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0
      };

      ordersData?.forEach(order => {
        const status = order.status?.toLowerCase() || '';
        if (status === 'pending') newOrderStats.pending++;
        else if (status === 'processing') newOrderStats.processing++;
        else if (status === 'shipped') newOrderStats.shipped++;
        else if (status === 'delivered') newOrderStats.delivered++;
        else if (status === 'cancelled') newOrderStats.cancelled++;
      });
      setOrderStats(newOrderStats);

      // 3. Process Sales Data (Initial Load)
      await fetchSalesDataOnly();

      // 4. Fetch Inventory Alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('products')
        .select('id, name, stock')
        .lt('stock', 10)
        .order('stock', { ascending: true })
        .limit(5);

      if (alertsError) console.error("Error fetching inventory alerts:", alertsError);

      const alerts = alertsData?.map(product => ({
        id: product.id,
        name: product.name,
        stock: product.stock || 0
      })) || [];
      setInventoryAlerts(alerts);

      // 5. Fetch Recent Orders
      const { data: recentOrdersData, error: recentOrdersError } = await supabase
        .from('orders')
        .select('id, customer_name, total_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentOrdersError) throw recentOrdersError;
      setRecentOrders(recentOrdersData || []);

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully.",
    });
    navigate('/admin');
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (!adminUser) return null;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Admin Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo & Title */}
            <div className="flex flex-col items-start gap-0.5 select-none">
              <img
                src={krLogo}
                alt="KR Fireworks"
                className="h-8 md:h-10 object-contain"
              />
              <p className="text-[10px] md:text-xs font-semibold text-red-600 italic tracking-wide font-serif hidden sm:block">
                'n' joy with Every moments...
              </p>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <Link to="/admin/dashboard" className="text-red-600 font-bold border-b-2 border-red-600">Dashboard</Link>
              <Link to="/admin/products" className="text-gray-600 hover:text-red-600 font-medium transition-colors">Products</Link>
              <Link to="/admin/categories" className="text-gray-600 hover:text-red-600 font-medium transition-colors">Categories</Link>
              <Link to="/admin/orders" className="text-gray-600 hover:text-red-600 font-medium transition-colors">Orders</Link>
              <Link to="/admin/users" className="text-gray-600 hover:text-red-600 font-medium transition-colors">Users</Link>
              <Link to="/admin/reviews" className="text-gray-600 hover:text-red-600 font-medium transition-colors">Reviews</Link>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">KrFireworks</p>
                  <p className="text-xs text-gray-500">{adminUser.email}</p>
                </div>
                <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-100">Admin</Badge>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="hover:bg-red-50 hover:text-red-600 text-gray-600 gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </Button>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <Menu className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-2 border-t border-gray-100 pt-2">
              <Link to="/admin/dashboard" className="block py-2 text-red-600 font-bold">Dashboard</Link>
              <Link to="/admin/products" className="block py-2 text-gray-600 hover:text-red-600">Products</Link>
              <Link to="/admin/categories" className="block py-2 text-gray-600 hover:text-red-600">Categories</Link>
              <Link to="/admin/orders" className="block py-2 text-gray-600 hover:text-red-600">Orders</Link>
              <Link to="/admin/users" className="block py-2 text-gray-600 hover:text-red-600">Users</Link>
              <Link to="/admin/reviews" className="block py-2 text-gray-600 hover:text-red-600">Reviews</Link>
            </div>
          )}
        </div>
      </nav>

      {/* Dashboard Content */}
      <main className="container mx-auto px-4 py-6">



        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-6">


            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">Total Users</p>
                      <h3 className="text-3xl font-bold text-gray-900">{stats.totalUsers}</h3>
                      <p className="text-xs text-rose-500 mt-2 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Registered Accounts
                      </p>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-full text-rose-500">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">Total Orders</p>
                      <h3 className="text-3xl font-bold text-gray-900">{stats.totalOrders}</h3>
                      <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> Lifetime Orders
                      </p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-full text-orange-500">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">Total Revenue</p>
                      <h3 className="text-3xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</h3>
                      <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                        <Database className="w-3 h-3" /> Active Revenue
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-full text-green-500">
                      <Database className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>



            {/* Order Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-rose-500 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-1 text-rose-500">
                  <Clock className="w-4 h-4" />
                  <span className="font-semibold">Pending</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{orderStats.pending}</span>
                <span className="text-[10px] text-gray-400">Active</span>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-blue-500 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-1 text-blue-500">
                  <Activity className="w-4 h-4" />
                  <span className="font-semibold">Processing</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{orderStats.processing}</span>
                <span className="text-[10px] text-gray-400">Active</span>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-orange-500 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-1 text-orange-500">
                  <Truck className="w-4 h-4" />
                  <span className="font-semibold">Shipped</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{orderStats.shipped}</span>
                <span className="text-[10px] text-gray-400">Active</span>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-green-500 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-1 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-semibold">Delivered</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{orderStats.delivered}</span>
                <span className="text-[10px] text-gray-400">Completed</span>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-red-500 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-1 text-red-500">
                  <XCircle className="w-4 h-4" />
                  <span className="font-semibold">Cancelled</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{orderStats.cancelled}</span>
                <span className="text-[10px] text-gray-400">Inactive</span>
              </div>
            </div>

            {/* Recent Orders Table */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-red-500" />
                    Recent Orders
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600" onClick={() => navigate('/admin/orders')}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-4 py-3 rounded-l-lg">Order ID</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 rounded-r-lg">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                            No orders found
                          </td>
                        </tr>
                      ) : (
                        recentOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-4 font-medium text-gray-900">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-50 rounded-full text-rose-500">
                                  <ShoppingCart className="w-3 h-3" />
                                </div>
                                #{order.id.slice(0, 6)}...
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-600">
                              <div className="font-medium">{order.customer_name}</div>
                            </td>
                            <td className="px-4 py-4 font-bold text-gray-900">₹{order.total_amount}</td>
                            <td className="px-4 py-4 text-gray-500">
                              <div className="flex flex-col">
                                <span>{new Date(order.created_at).toLocaleDateString()}</span>
                                <span className="text-[10px]">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Badge
                                className={`${order.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                  order.status === 'processing' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' :
                                      order.status === 'shipped' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' :
                                        'bg-red-100 text-red-700 hover:bg-red-100'
                                  } border-none shadow-none`}
                              >
                                {order.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => viewOrderDetails(order.id)}
                                >
                                  <ArrowUpRight className="w-4 h-4 text-gray-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openStatusDialog(order.id, order.status)}
                                >
                                  <Activity className="w-4 h-4 text-blue-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Sales Analytics Chart */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-gray-900">Sales Analytics</CardTitle>
                  <span className="text-sm font-bold text-gray-900">
                    ₹{salesData.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Badge
                    variant={salesRange === 'today' ? 'default' : 'outline'}
                    className={`text-[10px] cursor-pointer ${salesRange === 'today' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                    onClick={() => setSalesRange('today')}
                  >
                    Today
                  </Badge>
                  <Badge
                    variant={salesRange === 'week' ? 'default' : 'outline'}
                    className={`text-[10px] cursor-pointer ${salesRange === 'week' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                    onClick={() => setSalesRange('week')}
                  >
                    Week
                  </Badge>
                  <Badge
                    variant={salesRange === 'month' ? 'default' : 'outline'}
                    className={`text-[10px] cursor-pointer ${salesRange === 'month' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                    onClick={() => setSalesRange('month')}
                  >
                    Month
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar
                      dataKey="total"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

          </div>

          {/* Sidebar Area (Right Column) */}
          <div className="space-y-6">

            {/* Quick Stats Panel */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-gray-900">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500 text-sm">Today's Revenue</span>
                  <span className="font-bold text-gray-900">₹{stats.todayRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500 text-sm">This Month</span>
                  <span className="font-bold text-gray-900">₹{stats.monthRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500 text-sm">Lifetime Revenue</span>
                  <span className="font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500 text-sm">Paid Orders</span>
                  <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <CheckCircle className="w-3 h-3" /> {stats.paidOrders}
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500 text-sm">Failed Payments</span>
                  <div className="flex items-center gap-1 text-orange-500 text-sm font-medium">
                    <AlertCircle className="w-3 h-3" /> {orderStats.cancelled}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-500 text-sm">COD Pending</span>
                  <div className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
                    <Package className="w-3 h-3" /> {orderStats.pending}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Alerts */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-gray-900">Inventory Alerts</CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-red-50 text-red-600 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => navigate('/admin/products')}
                  >
                    {inventoryAlerts.length > 0 ? inventoryAlerts.length : '0'} &gt;
                  </Badge>
                </div>
                {inventoryAlerts.length > 0 && <span className="text-xs text-red-500 font-medium flex items-center gap-1">● Low Stock</span>}
              </CardHeader>
              <CardContent className="space-y-3">
                {inventoryAlerts.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-gray-400 italic mb-2">No inventory alerts.</p>
                    <Button variant="link" size="sm" className="text-red-600 h-auto p-0" onClick={() => navigate('/admin/products')}>
                      View All Products
                    </Button>
                  </div>
                ) : (
                  inventoryAlerts.map(alert => (
                    <div key={alert.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md transition-colors cursor-pointer" onClick={() => navigate('/admin/products')}>
                      <div className="flex items-center gap-2">
                        {alert.stock === 0 ? <AlertCircle className="w-4 h-4 text-red-500" /> : <Package className="w-4 h-4 text-yellow-500" />}
                        <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{alert.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {alert.stock === 0 ? (
                          <span className="text-xs font-bold text-red-500">Out of stock</span>
                        ) : (
                          <span className="text-xs font-bold text-gray-900">{alert.stock} left</span>
                        )}
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-none shadow-sm bg-gray-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-red-700 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => navigate('/admin/products')}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
                >
                  <ArrowUpRight className="w-4 h-4 mr-2" /> Add New Product
                </Button>
                <Button
                  onClick={() => navigate('/admin/users')}
                  variant="outline"
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                >
                  <Users className="w-4 h-4 mr-2" /> Manage Users
                </Button>
                <Button
                  onClick={() => navigate('/admin/orders')}
                  variant="outline"
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" /> View All Orders
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>

      {/* Order Details Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.id?.slice(0, 8)}</DialogTitle>
            <DialogDescription>
              Placed on {new Date(selectedOrder?.created_at).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-gray-500 mb-1">Customer</h4>
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.customer_email}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.customer_phone}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-500 mb-1">Status</h4>
                  <Badge>{selectedOrder.status}</Badge>
                  <p className="mt-2 text-xl font-bold">₹{selectedOrder.total_amount}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-500 mb-2">Shipping Address</h4>
                <p className="text-sm bg-slate-50 p-2 rounded whitespace-pre-line">{selectedOrder.shipping_address}, {selectedOrder.city}, {selectedOrder.state} - {selectedOrder.pincode}</p>
              </div>

              {/* Items would go here if available in the fetched object, but recentOrders query uses specific columns. 
                   Ideally viewOrderDetails fetches the full object including items. 
               */}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>Close</Button>
            <Button onClick={() => { setIsOrderDialogOpen(false); navigate('/admin/orders'); }}>View Full Details</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Change the status of the order. This will notify the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-[180px] col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChange}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
