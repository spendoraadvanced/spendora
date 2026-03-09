// SPENDORA ADVANCED - SERVER
// Complete Personal Finance Management System
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const app = express();
// CONFIGURATION
const JWT_SECRET = process.env.JWT_SECRET || 'spendora-secret-key-2024';
const PORT = process.env.PORT || 3000;
const MONGODB_URI = "mongodb+srv://spendora:spendora2026@spendoraadvanced.wk76sau.mongodb.net/?retryWrites=true&w=majority&appName=spendoraadvanced";
app.use(express.json());
app.use(cors());
app.use(express.static('public'));
// DATABASE CONNECTION
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    console.log('📊 Database ready for Spendora Advanced');
})
.catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);});
// SCHEMAS
// User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, default: 'User' },
    currency: { type: String, default: 'INR' },
    monthlyBudget: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }});
// Expense Schema
const ExpenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { 
        type: String, 
        required: true,
        enum: ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Others'],
        default: 'Others'
    },
    note: { type: String, default: '' },
    date: { type: Date, required: true },
    isRecurring: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }});
// Savings Goal Schema
const SavingsGoalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    goalName: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    savedAmount: { type: Number, default: 0 },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['active', 'completed', 'expired'], default: 'active' },
    createdAt: { type: Date, default: Date.now }});
// Budget Schema
const BudgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { 
        type: String, 
        required: true,
        enum: ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Others']
    },
    limitAmount: { type: Number, required: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }});
// Create Models
const User = mongoose.model('User', UserSchema);
const Expense = mongoose.model('Expense', ExpenseSchema);
const SavingsGoal = mongoose.model('SavingsGoal', SavingsGoalSchema);
const Budget = mongoose.model('Budget', BudgetSchema);
// AUTHENTICATION MIDDLEWARE
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });}
        req.userId = decoded.userId;
        next();
    });}
// AUTHENTICATION ROUTES
// SIGNUP
app.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });}
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });}
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email,
            password: hashedPassword,
            name: name || 'User'
        });
        await user.save();
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: { id: user._id, email: user.email, name: user.name }});
        } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }});
// LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: user._id, email: user.email, name: user.name }
        });
        } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }});
// USER PROFILE ROUTES
// GET PROFILE
app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// UPDATE PROFILE
app.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name, currency, monthlyBudget } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (currency) updateData.currency = currency;
        if (monthlyBudget !== undefined) updateData.monthlyBudget = monthlyBudget;
        const user = await User.findByIdAndUpdate(
            req.userId,
            updateData,
            { new: true }
        ).select('-password');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// EXPENSE ROUTES
// GET ALL EXPENSES
app.get('/expenses', authenticateToken, async (req, res) => {
    try {
        const { category, month, year } = req.query;
        let query = { userId: req.userId };
        // Filter by category
        if (category && category !== 'all') {
            query.category = category;}
        // Filter by month and year
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
         query.date = { $gte: startDate, $lte: endDate };}
        const expenses = await Expense.find(query).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// ADD EXPENSE
app.post('/expenses', authenticateToken, async (req, res) => {
    try {
        const { title, amount, category, note, date, isRecurring } = req.body;
        const expense = new Expense({
            userId: req.userId,
            title,
            amount,
            category,
            note,
            date,
            isRecurring
        });
        await expense.save();
        res.status(201).json({ success: true, expense });
    } catch (error) {
        console.error('Add expense error:', error);
        res.status(500).json({ error: 'Server error' });
    }});
// UPDATE EXPENSE
app.put('/expenses/:id', authenticateToken, async (req, res) => {
    try {
        const { title, amount, category, note, date, isRecurring } = req.body;
        const expense = await Expense.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { title, amount, category, note, date, isRecurring },
            { new: true });
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });}
        res.json({ success: true, expense });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// DELETE EXPENSE
app.delete('/expenses/:id', authenticateToken, async (req, res) => {
    try {
        const expense = await Expense.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });}
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// BUDGET ROUTES
// GET BUDGETS
app.get('/budgets', authenticateToken, async (req, res) => {
    try {
        const { month, year } = req.query;
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();
        const budgets = await Budget.find({
            userId: req.userId,
            month: currentMonth,
            year: currentYear
        });
        res.json(budgets);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// SET BUDGET
app.post('/budgets', authenticateToken, async (req, res) => {
    try {
        const { category, limitAmount, month, year } = req.body;
        // Check if budget already exists
        const existing = await Budget.findOne({
            userId: req.userId,
            category,
            month,
            year
        });
        if (existing) {
            existing.limitAmount = limitAmount;
            await existing.save();
            return res.json({ success: true, budget: existing });}
        const budget = new Budget({
            userId: req.userId,
            category,
            limitAmount,
            month,
            year
        });
        await budget.save();
        res.status(201).json({ success: true, budget });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// SAVINGS GOAL ROUTES
// GET SAVINGS GOALS
app.get('/savings-goals', authenticateToken, async (req, res) => {
    try {
        const goals = await SavingsGoal.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(goals);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// CREATE SAVINGS GOAL
app.post('/savings-goals', authenticateToken, async (req, res) => {
    try {
        const { goalName, targetAmount, deadline } = req.body;
        const goal = new SavingsGoal({
            userId: req.userId,
            goalName,
            targetAmount,
            deadline
        });
        await goal.save();
        res.status(201).json({ success: true, goal });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// UPDATE SAVINGS GOAL (Add money)
app.put('/savings-goals/:id', authenticateToken, async (req, res) => {
    try {
        const { savedAmount } = req.body;
        const goal = await SavingsGoal.findOne({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });}
        if (savedAmount !== undefined) {
            goal.savedAmount = savedAmount;
// Check if goal completed
            if (goal.savedAmount >= goal.targetAmount) {
                goal.status = 'completed';}}
        await goal.save();
        res.json({ success: true, goal });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// DELETE SAVINGS GOAL
app.delete('/savings-goals/:id', authenticateToken, async (req, res) => {
    try {
        const goal = await SavingsGoal.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });}
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }});
// AI INSIGHTS ROUTE
app.get('/ai-insights', authenticateToken, async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        // Get current month expenses
        const expenses = await Expense.find({
            userId: req.userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });
        // Calculate total spending
        const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        // Category-wise spending
        const categorySpending = {};
        expenses.forEach(exp => {
            if (!categorySpending[exp.category]) {
                categorySpending[exp.category] = 0;
            }
            categorySpending[exp.category] += exp.amount;
        });
        // Find highest spending category
        let highestCategory = null;
        let highestAmount = 0;
        Object.entries(categorySpending).forEach(([cat, amount]) => {
            if (amount > highestAmount) {
                highestAmount = amount;
                highestCategory = cat;
            }});
        // Get budgets
        const budgets = await Budget.find({
            userId: req.userId,
            month: now.getMonth() + 1,
            year: now.getFullYear()
        });
        // Check budget warnings
        const warnings = [];
        for (const budget of budgets) {
            const spent = categorySpending[budget.category] || 0;
            const percentage = (spent / budget.limitAmount) * 100;
            if (percentage >= 90) {
                warnings.push({
                    category: budget.category,
                    spent,
                    limit: budget.limitAmount,
                    percentage: Math.round(percentage)
                });}}
        // Generate suggestions
        const suggestions = [];
        if (highestCategory) {
            suggestions.push({
                type: 'spending',
                message: `Your highest spending is on ${highestCategory} (₹${highestAmount.toFixed(2)}). Consider setting a budget limit.`
            });}
        if (warnings.length > 0) {
            warnings.forEach(w => {
                suggestions.push({
                    type: 'warning',
                    message: `${w.category} budget ${w.percentage}% used! (₹${w.spent.toFixed(2)} / ₹${w.limit})`
                });
            });}
        if (totalSpending > 0) {
            const avgDailySpending = totalSpending / now.getDate();
            suggestions.push({
                type: 'info',
                message: `Your average daily spending is ₹${avgDailySpending.toFixed(2)}`
            });}
        res.json({
            totalSpending,
            categorySpending,
            highestCategory,
            warnings,
            suggestions
        });
        } catch (error) {
        console.error('AI Insights error:', error);
        res.status(500).json({ error: 'Server error' }); }
});
// START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   🚀 SPENDORA ADVANCED SERVER           ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║   📱 Local: http://localhost:${PORT}        ║`);
    console.log('║   💰 Advanced Finance Management         ║');
    console.log('╚══════════════════════════════════════════╝\n');
});
