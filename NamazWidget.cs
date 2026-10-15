using System;
using System.IO;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Threading;
using System.Diagnostics;
using System.Drawing;
using Forms = System.Windows.Forms;

namespace NamazNativeWidget
{
    public class WidgetWindow : Window
    {
        // UI Visual Controls
        private Border outerCard;
        private DropShadowEffect cardShadow;
        private Border liveDot;
        private Border prayerBadge;
        private TextBlock txtPrayerName;
        private TextBlock txtCityName;
        private Button btnPeek;
        private Button btnScale;
        private Button btnPin;
        private MenuItem menuPin;
        private MenuItem menuScale;
        private MenuItem menuSound;
        private MenuItem menuOpacity100;
        private MenuItem menuOpacity85;
        private MenuItem menuOpacity70;

        // Hero Section
        private TextBlock txtCountdownNum;
        private TextBlock txtCountdownUnit;
        private DropShadowEffect numGlow;
        private StackPanel heroPanel;

        // Today's Schedule Peek Grid
        private Grid peekPanel;
        private Border[] peekCells = new Border[6];
        private TextBlock[] peekNames = new TextBlock[6];
        private TextBlock[] peekTimes = new TextBlock[6];
        private bool isPeekMode = false;

        // Progress Gauge
        private Grid progressContainer;
        private ColumnDefinition colElapsed;
        private ColumnDefinition colRemaining;
        private Border progressBarFill;
        private Border progressTrack;

        // Footer Section
        private Border footerBorder;
        private TextBlock txtSubtext;

        // Prohibited Times Banner
        private Border prohibitedShield;
        private TextBlock txtProhibitedText;

        // System Tray Integration
        private Forms.NotifyIcon notifyIcon;
        private bool isExplicitExit = false;
        private bool hasShownTrayTip = false;

        // State & Settings
        private DispatcherTimer timer;
        private string configDir;
        private string configFile;
        private bool isLargeMode = false;
        private double widgetOpacity = 0.85;
        private bool isSoundEnabled = true;
        private string lastChimedPrayer = "";
        private int pulseCounter = 0;

        // Surat Coordinates (Default)
        private double lat = 21.1960;
        private double lng = 72.7940;
        private string cityName = "Surat";

        public WidgetWindow()
        {
            // Base Window Setup
            this.Title = "Namaz Times Desktop Widget";
            this.WindowStyle = WindowStyle.None;
            this.AllowsTransparency = true;
            this.Background = System.Windows.Media.Brushes.Transparent;
            this.Topmost = false;
            this.ShowInTaskbar = true; // Stays open and accessible from desktop and taskbar
            this.ResizeMode = ResizeMode.NoResize;

            string icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icons", "app.ico");
            if (File.Exists(icoPath))
            {
                try
                {
                    this.Icon = new System.Windows.Media.Imaging.BitmapImage(new Uri(icoPath, UriKind.Absolute));
                }
                catch { }
            }

            // Ensure widget stays displayed on the desktop and does not disappear when Win+D or other apps minimize
            this.StateChanged += delegate
            {
                if (this.WindowState == WindowState.Minimized && !isExplicitExit && this.IsVisible)
                {
                    this.WindowState = WindowState.Normal;
                }
            };

            configDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NamazTimes");
            configFile = Path.Combine(configDir, "widget_config.txt");

            BuildUI();
            SetupSystemTray();
            LoadConfig();

            // Drag Window Anywhere on left click hold
            this.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs e)
            {
                if (e.ButtonState == MouseButtonState.Pressed)
                {
                    this.DragMove();
                    SaveConfig();
                }
            };

            // Double Click toggles between Compact and Large Room Mode
            this.MouseDoubleClick += delegate(object sender, MouseButtonEventArgs e)
            {
                ToggleSizeMode();
            };

            // Minimize to tray on close button
            this.Closing += delegate(object sender, System.ComponentModel.CancelEventArgs e)
            {
                if (!isExplicitExit)
                {
                    e.Cancel = true;
                    this.ShowInTaskbar = false;
                    this.Hide();
                    if (!hasShownTrayTip && notifyIcon != null)
                    {
                        hasShownTrayTip = true;
                        notifyIcon.ShowBalloonTip(2500, "Namaz Times", "Widget running in system tray. Click icon to restore anytime.", Forms.ToolTipIcon.Info);
                    }
                }
            };

            // Right-Click Context Menu
            BuildContextMenu();

            // 1-Second Precision Timer
            timer = new DispatcherTimer();
            timer.Interval = TimeSpan.FromSeconds(1);
            timer.Tick += delegate { UpdateTimings(); };
            timer.Start();

            // Initial Render
            UpdateTimings();
        }

        private void BuildUI()
        {
            outerCard = new Border();
            outerCard.CornerRadius = new CornerRadius(16);
            outerCard.Background = new LinearGradientBrush(
                System.Windows.Media.Color.FromRgb(8, 13, 23),
                System.Windows.Media.Color.FromRgb(4, 7, 14),
                new System.Windows.Point(0, 0),
                new System.Windows.Point(1, 1)
            );
            outerCard.BorderThickness = new Thickness(1.5);
            outerCard.BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(50, 16, 185, 129));

            cardShadow = new DropShadowEffect
            {
                Color = System.Windows.Media.Colors.Black,
                Direction = 270,
                ShadowDepth = 6,
                Opacity = 0.7,
                BlurRadius = 24
            };
            outerCard.Effect = cardShadow;

            Grid mainGrid = new Grid();
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // 0: Header
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // 1: Prohibited Banner
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // 2: Hero / Peek
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // 3: Progress
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // 4: Footer

            // ==================== ROW 0: HEADER ====================
            Grid headerGrid = new Grid();
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            // Left: Live Status Dot + Pill Badge for Prayer Name
            StackPanel leftGroup = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };

            liveDot = new Border
            {
                Width = 7,
                Height = 7,
                CornerRadius = new CornerRadius(3.5),
                Background = new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)),
                Margin = new Thickness(0, 0, 7, 0),
                Effect = new DropShadowEffect
                {
                    Color = System.Windows.Media.Color.FromRgb(16, 185, 129),
                    ShadowDepth = 0,
                    BlurRadius = 8,
                    Opacity = 0.95
                }
            };
            leftGroup.Children.Add(liveDot);

            prayerBadge = new Border
            {
                CornerRadius = new CornerRadius(6),
                Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(40, 255, 255, 255)),
                Padding = new Thickness(7, 2, 7, 2)
            };

            txtPrayerName = new TextBlock
            {
                Text = "DHUHR",
                FontSize = 13.5,
                FontWeight = FontWeights.ExtraBold,
                FontFamily = new System.Windows.Media.FontFamily("Bahnschrift, Segoe UI, Arial"),
                Foreground = System.Windows.Media.Brushes.White,
                VerticalAlignment = VerticalAlignment.Center
            };
            prayerBadge.Child = txtPrayerName;
            leftGroup.Children.Add(prayerBadge);

            Grid.SetColumn(leftGroup, 0);
            headerGrid.Children.Add(leftGroup);

            // Center: Location / City Name
            txtCityName = new TextBlock
            {
                Text = cityName,
                FontSize = 11,
                FontWeight = FontWeights.SemiBold,
                FontFamily = new System.Windows.Media.FontFamily("Bahnschrift, Segoe UI, Arial"),
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184)),
                HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(txtCityName, 1);
            headerGrid.Children.Add(txtCityName);

            // Right: Interactive Buttons (Peek, Scale, Pin, Full App, Close)
            StackPanel actionGroup = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };

            btnPeek = CreateSmallButton("📋", "Today's Schedule Peek (Toggle)");
            btnPeek.Click += delegate { TogglePeekMode(); };
            actionGroup.Children.Add(btnPeek);

            Button btnGuide = CreateSmallButton("📖", "Bahar-e-Shariat Timing Guide");
            btnGuide.Click += delegate { ShowTimingGuideWindow(); };
            actionGroup.Children.Add(btnGuide);

            btnScale = CreateSmallButton("🗖", "Large Room Mode (Toggle)");
            btnScale.Click += delegate { ToggleSizeMode(); };
            actionGroup.Children.Add(btnScale);

            btnPin = CreateSmallButton("📌", "Always on Top (Toggle)");
            btnPin.Click += delegate { ToggleTopmost(); };
            actionGroup.Children.Add(btnPin);

            Button btnExpand = CreateSmallButton("⤢", "Open Full Timetable");
            btnExpand.Click += delegate { OpenFullApp(); };
            actionGroup.Children.Add(btnExpand);

            Button btnClose = CreateSmallButton("✕", "Minimize to System Tray");
            btnClose.Click += delegate { this.Close(); };
            actionGroup.Children.Add(btnClose);

            Grid.SetColumn(actionGroup, 2);
            headerGrid.Children.Add(actionGroup);

            Grid.SetRow(headerGrid, 0);
            mainGrid.Children.Add(headerGrid);

            // ==================== ROW 1: PROHIBITED TIMES SHIELD ====================
            prohibitedShield = new Border
            {
                Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(160, 220, 38, 38)),
                CornerRadius = new CornerRadius(5),
                Padding = new Thickness(6, 2, 6, 2),
                Margin = new Thickness(0, 4, 0, 2),
                Visibility = Visibility.Collapsed
            };

            txtProhibitedText = new TextBlock
            {
                Text = "🚫 PROHIBITED PRAYER TIME",
                FontSize = 10,
                FontWeight = FontWeights.ExtraBold,
                FontFamily = new System.Windows.Media.FontFamily("Bahnschrift, Segoe UI, Arial"),
                Foreground = System.Windows.Media.Brushes.White,
                HorizontalAlignment = System.Windows.HorizontalAlignment.Center
            };
            prohibitedShield.Child = txtProhibitedText;

            Grid.SetRow(prohibitedShield, 1);
            mainGrid.Children.Add(prohibitedShield);

            // ==================== ROW 2: HERO COUNTDOWN & PEEK PANEL ====================
            Grid displayContainer = new Grid();

            heroPanel = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };

            numGlow = new DropShadowEffect
            {
                Color = System.Windows.Media.Color.FromRgb(16, 185, 129),
                BlurRadius = 22,
                ShadowDepth = 0,
                Opacity = 0.55
            };

            txtCountdownNum = new TextBlock
            {
                Text = "--",
                FontSize = 46,
                FontWeight = FontWeights.Bold,
                FontFamily = new System.Windows.Media.FontFamily("Bahnschrift, Segoe UI, Consolas"),
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)),
                VerticalAlignment = VerticalAlignment.Bottom,
                Effect = numGlow
            };
            heroPanel.Children.Add(txtCountdownNum);

            txtCountdownUnit = new TextBlock
            {
                Text = "MIN LEFT",
                FontSize = 13,
                FontWeight = FontWeights.Bold,
                FontFamily = new System.Windows.Media.FontFamily("Bahnschrift, Segoe UI, Arial"),
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184)),
                VerticalAlignment = VerticalAlignment.Bottom,
                Margin = new Thickness(8, 0, 0, 7)
            };
            heroPanel.Children.Add(txtCountdownUnit);

            displayContainer.Children.Add(heroPanel);

            // Today's Schedule Peek Grid (6 Prayers in 3x2 matrix)
            peekPanel = new Grid
            {
                Visibility = Visibility.Collapsed,
                Margin = new Thickness(0, 3, 0, 3)
            };
            peekPanel.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            peekPanel.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            peekPanel.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            peekPanel.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            peekPanel.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            string[] defaultPNames = new string[] { "FAJR", "SUNRISE", "DHUHR", "ASR", "MAGHRIB", "ISHA" };

            for (int i = 0; i < 6; i++)
            {
                Border cell = new Border
                {
                    Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(20, 255, 255, 255)),
                    CornerRadius = new CornerRadius(5),
                    Margin = new Thickness(2),
                    Padding = new Thickness(4, 2, 4, 2)
                };

                StackPanel cellStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center };

                TextBlock pTitle = new TextBlock
                {
                    Text = defaultPNames[i],
                    FontSize = 9.5,
                    FontWeight = FontWeights.Bold,
                    FontFamily = new System.Windows.Media.FontFamily("Bahnschrift, Segoe UI, Arial"),
                    Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184)),
                    HorizontalAlignment = System.Windows.HorizontalAlignment.Center
                };
                cellStack.Children.Add(pTitle);

                TextBlock pVal = new TextBlock
                {
                    Text = "--:--",
                    FontSize = 11,
                    FontWeight = FontWeights.ExtraBold,
                    FontFamily = new System.Windows.Media.FontFamily("Bahnschrift, Segoe UI, Consolas"),
                    Foreground = System.Windows.Media.Brushes.White,
                    HorizontalAlignment = System.Windows.HorizontalAlignment.Center
                };
                cellStack.Children.Add(pVal);

                cell.Child = cellStack;

                int col = i % 3;
                int row = i / 3;
                Grid.SetColumn(cell, col);
                Grid.SetRow(cell, row);
                peekPanel.Children.Add(cell);

                peekCells[i] = cell;
                peekNames[i] = pTitle;
                peekTimes[i] = pVal;
            }

            displayContainer.Children.Add(peekPanel);

            Grid.SetRow(displayContainer, 2);
            mainGrid.Children.Add(displayContainer);

            // ==================== ROW 3: PROGRESS GAUGE ====================
            progressContainer = new Grid
            {
                Margin = new Thickness(2, 2, 2, 8)
            };
            colElapsed = new ColumnDefinition { Width = new GridLength(0.5, GridUnitType.Star) };
            colRemaining = new ColumnDefinition { Width = new GridLength(0.5, GridUnitType.Star) };
            progressContainer.ColumnDefinitions.Add(colElapsed);
            progressContainer.ColumnDefinitions.Add(colRemaining);

            // Background Track
            progressTrack = new Border
            {
                Height = 5,
                CornerRadius = new CornerRadius(2.5),
                Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(50, 51, 65, 85))
            };
            Grid.SetColumnSpan(progressTrack, 2);
            progressContainer.Children.Add(progressTrack);

            // Active Elapsed Fill
            progressBarFill = new Border
            {
                Height = 5,
                CornerRadius = new CornerRadius(2.5),
                Background = new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)),
                HorizontalAlignment = System.Windows.HorizontalAlignment.Stretch,
                Effect = new DropShadowEffect
                {
                    Color = System.Windows.Media.Color.FromRgb(16, 185, 129),
                    ShadowDepth = 0,
                    BlurRadius = 8,
                    Opacity = 0.7
                }
            };
            Grid.SetColumn(progressBarFill, 0);
            progressContainer.Children.Add(progressBarFill);

            Grid.SetRow(progressContainer, 3);
            mainGrid.Children.Add(progressContainer);

            // ==================== ROW 4: FOOTER ====================
            footerBorder = new Border
            {
                BorderThickness = new Thickness(0, 1, 0, 0),
                BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(18, 255, 255, 255)),
                Padding = new Thickness(0, 5, 0, 0),
                Cursor = Cursors.Hand
            };

            txtSubtext = new TextBlock
            {
                Text = "Calculating...",
                FontSize = 11,
                FontWeight = FontWeights.SemiBold,
                FontFamily = new System.Windows.Media.FontFamily("Bahnschrift, Segoe UI, Arial"),
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184)),
                HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
                TextTrimming = TextTrimming.CharacterEllipsis
            };
            footerBorder.Child = txtSubtext;

            // Footer hover peek trigger
            footerBorder.MouseEnter += delegate
            {
                if (!isPeekMode) SetPeekVisual(true);
            };
            footerBorder.MouseLeave += delegate
            {
                if (!isPeekMode) SetPeekVisual(false);
            };
            footerBorder.MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e)
            {
                e.Handled = true;
                TogglePeekMode();
            };

            Grid.SetRow(footerBorder, 4);
            mainGrid.Children.Add(footerBorder);

            outerCard.Child = mainGrid;
            this.Content = outerCard;

            // Apply sizing rules
            ApplyModeVisuals();
        }

        private void SetupSystemTray()
        {
            try
            {
                notifyIcon = new Forms.NotifyIcon();
                string icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icons", "app.ico");
                if (File.Exists(icoPath))
                {
                    notifyIcon.Icon = new Icon(icoPath);
                }
                else
                {
                    notifyIcon.Icon = SystemIcons.Application;
                }
                notifyIcon.Text = "Namaz Times Desktop Widget";
                notifyIcon.Visible = true;

                // Left click toggles window
                notifyIcon.MouseClick += delegate(object sender, Forms.MouseEventArgs e)
                {
                    if (e.Button == Forms.MouseButtons.Left)
                    {
                        if (this.IsVisible)
                        {
                            this.ShowInTaskbar = false;
                            this.Hide();
                        }
                        else
                        {
                            this.Show();
                            this.WindowState = WindowState.Normal;
                            this.ShowInTaskbar = true;
                            this.Activate();
                        }
                    }
                };

                // Tray Context Menu
                Forms.ContextMenu trayMenu = new Forms.ContextMenu();

                trayMenu.MenuItems.Add("Show / Hide Widget", delegate
                {
                    if (this.IsVisible)
                    {
                        this.ShowInTaskbar = false;
                        this.Hide();
                    }
                    else
                    {
                        this.Show();
                        this.WindowState = WindowState.Normal;
                        this.ShowInTaskbar = true;
                        this.Activate();
                    }
                });

                trayMenu.MenuItems.Add("-");

                Forms.MenuItem tPin = new Forms.MenuItem("📌 Always on Top", delegate
                {
                    ToggleTopmost();
                });
                tPin.Checked = this.Topmost;
                trayMenu.MenuItems.Add(tPin);

                Forms.MenuItem tScale = new Forms.MenuItem("🗖 Large Room Mode", delegate
                {
                    ToggleSizeMode();
                });
                trayMenu.MenuItems.Add(tScale);

                Forms.MenuItem tSound = new Forms.MenuItem("🔊 Sound Alerts (Chime)", delegate
                {
                    ToggleSound();
                });
                tSound.Checked = isSoundEnabled;
                trayMenu.MenuItems.Add(tSound);

                trayMenu.MenuItems.Add("📖 Bahar-e-Shariat Timing Guide", delegate
                {
                    ShowTimingGuideWindow();
                });

                trayMenu.MenuItems.Add("🌐 Open Full Timetable", delegate
                {
                    OpenFullApp();
                });

                trayMenu.MenuItems.Add("-");

                trayMenu.MenuItems.Add("✕ Exit Completely", delegate
                {
                    FullExit();
                });

                notifyIcon.ContextMenu = trayMenu;
            }
            catch { }
        }

        private void BuildContextMenu()
        {
            ContextMenu menu = new ContextMenu();

            menuScale = new MenuItem { Header = isLargeMode ? "🗗 Switch to Compact Mode" : "🗖 Switch to Large Room Mode" };
            menuScale.Click += delegate { ToggleSizeMode(); };
            menu.Items.Add(menuScale);

            MenuItem menuPeek = new MenuItem { Header = "📋 Toggle Today's Schedule Peek" };
            menuPeek.Click += delegate { TogglePeekMode(); };
            menu.Items.Add(menuPeek);

            MenuItem menuGuide = new MenuItem { Header = "📖 Bahar-e-Shariat Timing Guide" };
            menuGuide.Click += delegate { ShowTimingGuideWindow(); };
            menu.Items.Add(menuGuide);

            menuPin = new MenuItem { Header = "📌 Always on Top", IsCheckable = true, IsChecked = this.Topmost };
            menuPin.Click += delegate { ToggleTopmost(); };
            menu.Items.Add(menuPin);

            menuSound = new MenuItem { Header = "🔊 Sound Alerts (Chime on Start)", IsCheckable = true, IsChecked = isSoundEnabled };
            menuSound.Click += delegate { ToggleSound(); };
            menu.Items.Add(menuSound);

            // Opacity Submenu
            MenuItem menuOpacity = new MenuItem { Header = "🪟 Window Opacity (Glass)" };

            menuOpacity100 = new MenuItem { Header = "100% (Solid)", IsCheckable = true, IsChecked = Math.Abs(widgetOpacity - 1.0) < 0.05 };
            menuOpacity100.Click += delegate { SetOpacity(1.0); };
            menuOpacity.Items.Add(menuOpacity100);

            menuOpacity85 = new MenuItem { Header = "85% (Frosted Glass — Default)", IsCheckable = true, IsChecked = Math.Abs(widgetOpacity - 0.85) < 0.05 };
            menuOpacity85.Click += delegate { SetOpacity(0.85); };
            menuOpacity.Items.Add(menuOpacity85);

            menuOpacity70 = new MenuItem { Header = "70% (Ghost)", IsCheckable = true, IsChecked = Math.Abs(widgetOpacity - 0.70) < 0.05 };
            menuOpacity70.Click += delegate { SetOpacity(0.70); };
            menuOpacity.Items.Add(menuOpacity70);

            menu.Items.Add(menuOpacity);

            menu.Items.Add(new Separator());

            MenuItem menuOpen = new MenuItem { Header = "🌐 Open Full Timetable (Browser)" };
            menuOpen.Click += delegate { OpenFullApp(); };
            menu.Items.Add(menuOpen);

            MenuItem menuHide = new MenuItem { Header = "📥 Minimize to System Tray" };
            menuHide.Click += delegate { this.Close(); };
            menu.Items.Add(menuHide);

            menu.Items.Add(new Separator());

            MenuItem menuExit = new MenuItem { Header = "✕ Exit Completely" };
            menuExit.Click += delegate { FullExit(); };
            menu.Items.Add(menuExit);

            this.ContextMenu = menu;
        }

        private void TogglePeekMode()
        {
            isPeekMode = !isPeekMode;
            SetPeekVisual(isPeekMode);
        }

        private void SetPeekVisual(bool showPeek)
        {
            if (showPeek)
            {
                heroPanel.Visibility = Visibility.Collapsed;
                peekPanel.Visibility = Visibility.Visible;
                btnPeek.Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129));
            }
            else
            {
                heroPanel.Visibility = Visibility.Visible;
                peekPanel.Visibility = Visibility.Collapsed;
                btnPeek.Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184));
            }
        }

        private void ToggleSound()
        {
            isSoundEnabled = !isSoundEnabled;
            if (menuSound != null) menuSound.IsChecked = isSoundEnabled;
            if (isSoundEnabled)
            {
                try { System.Media.SystemSounds.Asterisk.Play(); } catch { }
            }
            SaveConfig();
        }

        private void SetOpacity(double op)
        {
            widgetOpacity = op;
            this.Opacity = widgetOpacity;
            if (menuOpacity100 != null) menuOpacity100.IsChecked = Math.Abs(widgetOpacity - 1.0) < 0.05;
            if (menuOpacity85 != null) menuOpacity85.IsChecked = Math.Abs(widgetOpacity - 0.85) < 0.05;
            if (menuOpacity70 != null) menuOpacity70.IsChecked = Math.Abs(widgetOpacity - 0.70) < 0.05;
            SaveConfig();
        }

        private void FullExit()
        {
            isExplicitExit = true;
            if (notifyIcon != null)
            {
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
            }
            this.Close();
            Application.Current.Shutdown();
        }

        private Button CreateSmallButton(string text, string tooltip)
        {
            Button btn = new Button
            {
                Content = text,
                ToolTip = tooltip,
                Width = 23,
                Height = 23,
                FontSize = 10.5,
                FontFamily = new System.Windows.Media.FontFamily("Segoe UI Emoji, Segoe UI, Arial"),
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184)),
                Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(20, 255, 255, 255)),
                BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(30, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(3, 0, 0, 0),
                Cursor = Cursors.Hand
            };

            btn.MouseEnter += delegate { btn.Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(50, 255, 255, 255)); };
            btn.MouseLeave += delegate { btn.Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(20, 255, 255, 255)); };

            return btn;
        }

        private void ToggleSizeMode()
        {
            isLargeMode = !isLargeMode;
            ApplyModeVisuals();
            SaveConfig();
        }

        private void ApplyModeVisuals()
        {
            if (isLargeMode)
            {
                this.Width = 415;
                this.Height = 235;
                outerCard.Padding = new Thickness(16, 12, 16, 12);
                txtPrayerName.FontSize = 17;
                txtCityName.FontSize = 13.5;
                txtCountdownNum.FontSize = 66;
                txtCountdownUnit.FontSize = 16.5;
                txtCountdownUnit.Margin = new Thickness(10, 0, 0, 10);
                progressTrack.Height = 7.5;
                progressTrack.CornerRadius = new CornerRadius(3.75);
                progressBarFill.Height = 7.5;
                progressBarFill.CornerRadius = new CornerRadius(3.75);
                txtSubtext.FontSize = 13.5;
                btnScale.Content = "🗗";
                btnScale.ToolTip = "Switch to Compact Mode";
                if (menuScale != null) menuScale.Header = "🗗 Switch to Compact Mode";

                for (int i = 0; i < 6; i++)
                {
                    peekNames[i].FontSize = 11.5;
                    peekTimes[i].FontSize = 14;
                }
            }
            else
            {
                this.Width = 290;
                this.Height = 165;
                outerCard.Padding = new Thickness(11, 9, 11, 9);
                txtPrayerName.FontSize = 13.5;
                txtCityName.FontSize = 11;
                txtCountdownNum.FontSize = 46;
                txtCountdownUnit.FontSize = 13;
                txtCountdownUnit.Margin = new Thickness(8, 0, 0, 7);
                progressTrack.Height = 5;
                progressTrack.CornerRadius = new CornerRadius(2.5);
                progressBarFill.Height = 5;
                progressBarFill.CornerRadius = new CornerRadius(2.5);
                txtSubtext.FontSize = 11;
                btnScale.Content = "🗖";
                btnScale.ToolTip = "Switch to Large Room Mode";
                if (menuScale != null) menuScale.Header = "🗖 Switch to Large Room Mode";

                for (int i = 0; i < 6; i++)
                {
                    peekNames[i].FontSize = 9.5;
                    peekTimes[i].FontSize = 11;
                }
            }

            // Keep on screen if boundary exceeded
            if (this.Left + this.Width > SystemParameters.WorkArea.Right)
                this.Left = Math.Max(0, SystemParameters.WorkArea.Right - this.Width - 25);
            if (this.Top + this.Height > SystemParameters.WorkArea.Bottom)
                this.Top = Math.Max(0, SystemParameters.WorkArea.Bottom - this.Height - 35);
        }

        private void ToggleTopmost()
        {
            this.Topmost = !this.Topmost;
            if (menuPin != null) menuPin.IsChecked = this.Topmost;
            if (btnPin != null)
            {
                btnPin.Foreground = this.Topmost
                    ? new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129))
                    : new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184));
            }
            SaveConfig();
        }

        private void OpenFullApp()
        {
            try
            {
                string localHtml = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "index.html");
                if (File.Exists(localHtml))
                {
                    Process.Start(new ProcessStartInfo(localHtml) { UseShellExecute = true });
                }
                else
                {
                    Process.Start(new ProcessStartInfo("https://hamidgazi.github.io/namaz/") { UseShellExecute = true });
                }
            }
            catch (Exception ex)
            {
                Forms.MessageBox.Show("Could not open full app: " + ex.Message, "Namaz Times");
            }
        }

        private Window guideWindow = null;

        private void ShowTimingGuideWindow()
        {
            try
            {
                if (guideWindow != null && guideWindow.IsVisible)
                {
                    guideWindow.Activate();
                    if (guideWindow.WindowState == WindowState.Minimized)
                        guideWindow.WindowState = WindowState.Normal;
                    return;
                }

                guideWindow = new Window
                {
                    Title = "📖 Bahar-e-Shariat Timing Guide & Color Logic",
                    Width = 550,
                    Height = 680,
                    WindowStartupLocation = WindowStartupLocation.CenterScreen,
                    Background = new SolidColorBrush(System.Windows.Media.Color.FromRgb(15, 23, 42)), // Slate 900
                    Foreground = System.Windows.Media.Brushes.White,
                    WindowStyle = WindowStyle.None,
                    AllowsTransparency = true,
                    BorderThickness = new Thickness(0),
                    ShowInTaskbar = true
                };

                // Root Border with glass styling & shadow
                Border rootBorder = new Border
                {
                    Background = new SolidColorBrush(System.Windows.Media.Color.FromRgb(15, 23, 42)),
                    BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(90, 51, 65, 85)),
                    BorderThickness = new Thickness(1.5),
                    CornerRadius = new CornerRadius(12)
                };

                Grid rootGrid = new Grid();
                rootGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Header
                rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Scrollable Body
                rootGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Footer buttons

                // Header with drag capability
                Border headerBorder = new Border
                {
                    Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(140, 30, 41, 59)),
                    CornerRadius = new CornerRadius(12, 12, 0, 0),
                    Padding = new Thickness(16, 12, 16, 12),
                    BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(50, 51, 65, 85)),
                    BorderThickness = new Thickness(0, 0, 0, 1)
                };
                headerBorder.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs e)
                {
                    if (e.ButtonState == MouseButtonState.Pressed) guideWindow.DragMove();
                };

                Grid headerGrid = new Grid();
                headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

                StackPanel titleStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
                TextBlock txtHead = new TextBlock
                {
                    Text = "📖 Bahar-e-Shariat Timing Guide & Color Logic",
                    FontSize = 14.5,
                    FontWeight = FontWeights.Bold,
                    FontFamily = new System.Windows.Media.FontFamily("Segoe UI, Bahnschrift, Arial"),
                    Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(52, 211, 153)) // Emerald 400
                };
                TextBlock txtSub = new TextBlock
                {
                    Text = "Hanafi Fiqh Rulings (Sadrush Shariah Allama Amjad Ali Azmi) & Color Psychology Engine",
                    FontSize = 10,
                    FontFamily = new System.Windows.Media.FontFamily("Segoe UI, Arial"),
                    Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184)),
                    Margin = new Thickness(0, 2, 0, 0)
                };
                titleStack.Children.Add(txtHead);
                titleStack.Children.Add(txtSub);
                Grid.SetColumn(titleStack, 0);
                headerGrid.Children.Add(titleStack);

                Button btnCloseModal = new Button
                {
                    Content = "✕",
                    Width = 28,
                    Height = 28,
                    Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(40, 255, 255, 255)),
                    Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(203, 213, 225)),
                    BorderThickness = new Thickness(0),
                    Cursor = Cursors.Hand,
                    FontSize = 13,
                    FontWeight = FontWeights.Bold
                };
                btnCloseModal.Click += delegate { guideWindow.Close(); };
                Grid.SetColumn(btnCloseModal, 1);
                headerGrid.Children.Add(btnCloseModal);

                headerBorder.Child = headerGrid;
                Grid.SetRow(headerBorder, 0);
                rootGrid.Children.Add(headerBorder);

                // Scrollable Content
                ScrollViewer scroll = new ScrollViewer
                {
                    VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                    HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                    Padding = new Thickness(16, 12, 16, 12)
                };

                StackPanel contentStack = new StackPanel();

                // Section 1: Color Psychology
                contentStack.Children.Add(CreateGuideSectionHeader("🎨 4-Tier Cognitive Color Psychology Engine"));
                TextBlock txtColorIntro = new TextBlock
                {
                    Text = "Color is processed by human neurology faster than text. Our engine uses scientifically tested color psychology paired with Hanafi rulings to keep you calmly aware without screen anxiety:",
                    FontSize = 11,
                    TextWrapping = TextWrapping.Wrap,
                    Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(203, 213, 225)),
                    Margin = new Thickness(0, 0, 0, 8)
                };
                contentStack.Children.Add(txtColorIntro);

                contentStack.Children.Add(CreateColorCard(
                    "🟢 Emerald Green (#10B981) — Peace, Tranquility & Khushu' (Itmi'nan)",
                    "Lowest cortisol wavelength (~555nm). Tells the brain: 'You have ample, safe time. Pray with full composure and focus.' Active during the vast majority of each prayer window.",
                    System.Windows.Media.Color.FromRgb(16, 185, 129)));

                contentStack.Children.Add(CreateColorCard(
                    "🟡 Solar Gold (#FBBF24) — Gentle Focus & Transition (Intibah)",
                    "High luminance without aggression. Signals that time has advanced midway. Finish your current task and prepare for wudhu/prayer peacefully.",
                    System.Windows.Media.Color.FromRgb(251, 191, 36)));

                contentStack.Children.Add(CreateColorCard(
                    "🟠 Sunset Orange (#F97316) — Urgent Warning & Makruh Horizon (Inzar)",
                    "High urgency. Marks entering disliked (Makruh) periods: Asr last 20m (Isfirar), Maghrib last 15m (stars clustered), or Zuhr last 25m (>90% elapsed). Stop working and pray immediately.",
                    System.Windows.Media.Color.FromRgb(249, 115, 22)));

                contentStack.Children.Add(CreateColorCard(
                    "🔴 Crimson Red Alert (#EF4444) — Critical Alert & Prohibition (Tahrim / Khatar)",
                    "Highest priority fight-or-flight signaling with breathing pulse and live seconds MM:SS. Active during prohibited zenith (Zawal), sunrise, and final minutes before prayer becomes Qadha.",
                    System.Windows.Media.Color.FromRgb(239, 68, 68)));

                // Section 2: Bahar-e-Shariat Rulings
                contentStack.Children.Add(CreateGuideSectionHeader("📜 Fiqh Rulings from Bahar-e-Shariat (Jild 1, Hissa 3)"));

                contentStack.Children.Add(CreatePrayerCard("🌅 FAJR (صبح صادق تا طلوع)",
                    "• Begins at Subh Sadiq (True Dawn) and ends at the exact moment of Sunrise.\n• Mustahabb for men is Isfar (broad daylight illumination), allowing 40-60 verses with calm Tartil.\n• Mustahabb for women is Ghalas (early darkness).\n• Color: 🟢 >30m  |  🟡 18–30m  |  🟠 10–18m  |  🔴 <10m (Sunrise alert)"));

                contentStack.Children.Add(CreatePrayerCard("☀️ SUNRISE, ISHRAQ & CHASHT (طلوع تا زوال)",
                    "• Sunrise Prohibition: Exactly 20 MINUTES after sunrise, all prayers (Fard, Qadha, Nafl) are strictly Haram (Vol 1, P 458 Masla 21).\n• Ishraq Sunnah: Starts at Sunrise + 20 min until ~50 min.\n• Chasht (Duha): Virtuous until midday.\n• Zawal Prohibition: The 10–12 min before Dhuhr zenith is strictly prohibited. App triggers 🚫 ZAWAL PROHIBITION."));

                contentStack.Children.Add(CreatePrayerCard("🌤️ DHUHR / JUMMAH (زوال تا مثلِ ثانی)",
                    "• Begins at Zawal and ends at Misl-e-Sani (2x shadow + noon shadow).\n• Mustahabb to delay in extreme summer heat (Ibrad) and pray early in winter.\n• Permissible across the entire window without inherent Karahat (P 461 Masla 35).\n• Color: 🟢 >45m  |  🟡 25–45m  |  🟠 12–25m (>90% elapsed)  |  🔴 <12m"));

                contentStack.Children.Add(CreatePrayerCard("🌇 ASR (مثلِ ثانی تا غروب)",
                    "• Begins at Misl-e-Sani (2x) and ends at complete sunset.\n• Mustahabb to delay into second half of time for congregation.\n• ⚠️ 20-Min Makruh Tahrimi: The final 20 min before Maghrib when the sun pales (Isfirar). Delaying Fard here without excuse is a grave sin (Hadith calls it hypocrite's prayer, P 456 Masla 12).\n• Color: 🟢 >35m  |  🟡 20–35m  |  🟠 ≤20m (Makruh Time)  |  🔴 <10m"));

                contentStack.Children.Add(CreatePrayerCard("🌆 MAGHRIB (غروب تا شفقِ ابیض)",
                    "• Begins at sunset and ends when white twilight vanishes (Shafaq Abyad, ~75m in Surat).\n• Ta'jeel (prompt prayer) is universally Mustahabb (P 457 Masla 15).\n• ⚠️ Stars Clustered Makruh: Delaying until stars cluster densely (final 15m) is Makruh Tahrimi!\n• At 44m left, >60% of time remains -> 100% Emerald Green.\n• Color: 🟢 >25m (Calm safe window)  |  🟡 15–25m  |  🟠 ≤15m (Makruh)  |  🔴 <8m"));

                contentStack.Children.Add(CreatePrayerCard("🌌 ISHA & WITR (شفقِ ابیض تا صبح صادق)",
                    "• Begins at Shafaq Abyad and ends at Fajr (9–10 hours span).\n• First 1/3 of the night is Mustahabb; up to Islamic Midnight (Nisf-ul-Layl) is Mubah.\n• ⚠️ Past Islamic Midnight: Delaying past midnight without valid excuse is Makruh Tanzihi (P 457 Masla 16). App alerts: 'Past Midnight (Makruh delay)'.\n• Color: 🟢 Safe early hours  |  🟠 ≤30m before Fajr  |  🔴 <15m"));

                // Section 3: Prohibited times
                contentStack.Children.Add(CreateGuideSectionHeader("🚫 The 3 Strictly Prohibited Times (Awqat-e-Mamnoo'ah)"));
                TextBlock txtProh = new TextBlock
                {
                    Text = "In these 3 specific times, NO prayer is permissible (neither Fard, Qadha, Nafl, nor Janazah, nor Sajdah Tilawat — Page 458 Masla 21):\n" +
                           "1. Sunrise (Tulu): Exactly 20 minutes from sunrise until sun rises 1 spear high.\n" +
                           "2. Midday Zenith (Zawal / Istiwa): 10–12 minutes immediately before Dhuhr.\n" +
                           "3. Sunset (Isfirar ash-Shams): The final 20 minutes before Maghrib (only today's delayed Asr Fard may be performed).",
                    FontSize = 11,
                    TextWrapping = TextWrapping.Wrap,
                    Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(248, 113, 113)),
                    Margin = new Thickness(0, 0, 0, 12)
                };
                contentStack.Children.Add(txtProh);

                scroll.Content = contentStack;
                Grid.SetRow(scroll, 1);
                rootGrid.Children.Add(scroll);

                // Footer Buttons
                Border footerBorder = new Border
                {
                    Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(140, 30, 41, 59)),
                    CornerRadius = new CornerRadius(0, 0, 12, 12),
                    Padding = new Thickness(14, 10, 14, 10),
                    BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(50, 51, 65, 85)),
                    BorderThickness = new Thickness(0, 1, 0, 0)
                };

                StackPanel btnRow = new StackPanel
                {
                    Orientation = Orientation.Horizontal,
                    HorizontalAlignment = System.Windows.HorizontalAlignment.Right
                };

                Button btnOpenDoc = new Button
                {
                    Content = "📄 Open Markdown Reference",
                    Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(50, 51, 65, 85)),
                    Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(203, 213, 225)),
                    BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(80, 100, 116, 139)),
                    BorderThickness = new Thickness(1),
                    Padding = new Thickness(10, 5, 10, 5),
                    Margin = new Thickness(0, 0, 8, 0),
                    Cursor = Cursors.Hand,
                    FontSize = 11
                };
                btnOpenDoc.Click += delegate
                {
                    try
                    {
                        string docPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "PRAYER_TIMING_GUIDE.md");
                        if (File.Exists(docPath))
                        {
                            Process.Start(new ProcessStartInfo(docPath) { UseShellExecute = true });
                        }
                    }
                    catch { }
                };
                btnRow.Children.Add(btnOpenDoc);

                Button btnClose = new Button
                {
                    Content = "Close Guide",
                    Background = new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)),
                    Foreground = System.Windows.Media.Brushes.White,
                    FontWeight = FontWeights.Bold,
                    BorderThickness = new Thickness(0),
                    Padding = new Thickness(14, 5, 14, 5),
                    Cursor = Cursors.Hand,
                    FontSize = 11
                };
                btnClose.Click += delegate { guideWindow.Close(); };
                btnRow.Children.Add(btnClose);

                footerBorder.Child = btnRow;
                Grid.SetRow(footerBorder, 2);
                rootGrid.Children.Add(footerBorder);

                rootBorder.Child = rootGrid;
                guideWindow.Content = rootBorder;

                guideWindow.Show();
                guideWindow.Activate();
            }
            catch (Exception ex)
            {
                Forms.MessageBox.Show("Could not open Timing Guide: " + ex.Message, "Namaz Times");
            }
        }

        private static Border CreateGuideSectionHeader(string title)
        {
            Border b = new Border
            {
                Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(50, 30, 41, 59)),
                BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(70, 71, 85, 105)),
                BorderThickness = new Thickness(0, 0, 0, 1),
                Padding = new Thickness(4, 6, 4, 6),
                Margin = new Thickness(0, 10, 0, 8)
            };
            TextBlock t = new TextBlock
            {
                Text = title,
                FontSize = 12.5,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(241, 245, 249))
            };
            b.Child = t;
            return b;
        }

        private static Border CreateColorCard(string title, string desc, System.Windows.Media.Color accent)
        {
            Border b = new Border
            {
                Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(35, accent.R, accent.G, accent.B)),
                BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(90, accent.R, accent.G, accent.B)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(6),
                Padding = new Thickness(10, 7, 10, 7),
                Margin = new Thickness(0, 0, 0, 6)
            };
            StackPanel sp = new StackPanel();
            TextBlock tTitle = new TextBlock
            {
                Text = title,
                FontSize = 11.5,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(accent)
            };
            TextBlock tDesc = new TextBlock
            {
                Text = desc,
                FontSize = 10.5,
                TextWrapping = TextWrapping.Wrap,
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(226, 232, 240)),
                Margin = new Thickness(0, 3, 0, 0)
            };
            sp.Children.Add(tTitle);
            sp.Children.Add(tDesc);
            b.Child = sp;
            return b;
        }

        private static Border CreatePrayerCard(string title, string body)
        {
            Border b = new Border
            {
                Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(40, 255, 255, 255)),
                BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromArgb(40, 148, 163, 184)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(6),
                Padding = new Thickness(10, 7, 10, 7),
                Margin = new Thickness(0, 0, 0, 6)
            };
            StackPanel sp = new StackPanel();
            TextBlock tTitle = new TextBlock
            {
                Text = title,
                FontSize = 11.5,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(56, 189, 248)) // Sky 400
            };
            TextBlock tBody = new TextBlock
            {
                Text = body,
                FontSize = 10.5,
                TextWrapping = TextWrapping.Wrap,
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(203, 213, 225)),
                Margin = new Thickness(0, 3, 0, 0)
            };
            sp.Children.Add(tTitle);
            sp.Children.Add(tBody);
            b.Child = sp;
            return b;
        }

        private void LoadConfig()
        {
            try
            {
                if (File.Exists(configFile))
                {
                    string[] lines = File.ReadAllLines(configFile);
                    foreach (string line in lines)
                    {
                        string[] parts = line.Split('=');
                        if (parts.Length == 2)
                        {
                            string key = parts[0].Trim();
                            string val = parts[1].Trim();
                            if (key == "Left") this.Left = double.Parse(val, CultureInfo.InvariantCulture);
                            if (key == "Top") this.Top = double.Parse(val, CultureInfo.InvariantCulture);
                            if (key == "Topmost")
                            {
                                this.Topmost = bool.Parse(val);
                                if (menuPin != null) menuPin.IsChecked = this.Topmost;
                                if (btnPin != null)
                                {
                                    btnPin.Foreground = this.Topmost
                                        ? new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129))
                                        : new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184));
                                }
                            }
                            if (key == "IsLargeMode")
                            {
                                isLargeMode = bool.Parse(val);
                                ApplyModeVisuals();
                            }
                            if (key == "Opacity")
                            {
                                widgetOpacity = double.Parse(val, CultureInfo.InvariantCulture);
                                SetOpacity(widgetOpacity);
                            }
                            if (key == "IsSoundEnabled")
                            {
                                isSoundEnabled = bool.Parse(val);
                                if (menuSound != null) menuSound.IsChecked = isSoundEnabled;
                            }
                        }
                    }
                }
                else
                {
                    this.Left = SystemParameters.WorkArea.Right - this.Width - 25;
                    this.Top = SystemParameters.WorkArea.Top + 35;
                    SetOpacity(widgetOpacity);
                }
            }
            catch
            {
                this.Left = SystemParameters.WorkArea.Right - this.Width - 25;
                this.Top = SystemParameters.WorkArea.Top + 35;
                SetOpacity(widgetOpacity);
            }

            if (this.Left < 0 || this.Left > SystemParameters.VirtualScreenWidth - 100)
                this.Left = SystemParameters.WorkArea.Right - this.Width - 25;
            if (this.Top < 0 || this.Top > SystemParameters.VirtualScreenHeight - 80)
                this.Top = SystemParameters.WorkArea.Top + 35;
        }

        private void SaveConfig()
        {
            try
            {
                if (!Directory.Exists(configDir)) Directory.CreateDirectory(configDir);
                string text = string.Format(CultureInfo.InvariantCulture,
                    "Left={0}\nTop={1}\nTopmost={2}\nIsLargeMode={3}\nOpacity={4}\nIsSoundEnabled={5}\n",
                    this.Left, this.Top, this.Topmost, isLargeMode, widgetOpacity, isSoundEnabled);
                File.WriteAllText(configFile, text);
            }
            catch { }
        }

        // ==================== ACCURATE SOLAR CALCULATION (JEAN MEEUS) ====================
        private const double DEG2RAD = Math.PI / 180.0;
        private const double RAD2DEG = 180.0 / Math.PI;

        private double FixAngle(double a) { a = a % 360.0; return a < 0 ? a + 360.0 : a; }
        private double FixHour(double h) { h = h % 24.0; return h < 0 ? h + 24.0 : h; }

        private double GetJulianDay(int year, int month, int day)
        {
            if (month <= 2) { year -= 1; month += 12; }
            int a = year / 100;
            int b = 2 - a + (a / 4);
            return Math.Floor(365.25 * (year + 4716)) + Math.Floor(30.6001 * (month + 1)) + day + b - 1524.5;
        }

        private void CalculateSolar(double jd, out double declination, out double eotMinutes)
        {
            double T = (jd - 2451545.0) / 36525.0;
            double L0 = FixAngle(280.46646 + 36000.76983 * T);
            double M = FixAngle(357.52911 + 35999.05029 * T);
            double C = (1.914602 - 0.004817 * T) * Math.Sin(M * DEG2RAD)
                     + (0.019993 - 0.000101 * T) * Math.Sin(2 * M * DEG2RAD)
                     + 0.000289 * Math.Sin(3 * M * DEG2RAD);
            double trueLong = FixAngle(L0 + C);
            double eps = 23.439291 - 0.0130042 * T;
            double sinDec = Math.Sin(eps * DEG2RAD) * Math.Sin(trueLong * DEG2RAD);
            declination = Math.Asin(sinDec);

            double y = Math.Pow(Math.Tan((eps / 2.0) * DEG2RAD), 2);
            double eotRad = y * Math.Sin(2 * L0 * DEG2RAD)
                          - 2 * 0.0167086 * Math.Sin(M * DEG2RAD)
                          + 4 * 0.0167086 * y * Math.Sin(M * DEG2RAD) * Math.Cos(2 * L0 * DEG2RAD)
                          - 0.5 * Math.Pow(y, 2) * Math.Sin(4 * L0 * DEG2RAD)
                          - 1.25 * Math.Pow(0.0167086, 2) * Math.Sin(2 * M * DEG2RAD);
            eotMinutes = 4.0 * (eotRad * RAD2DEG);
        }

        private double ComputeHourAngle(double altDeg, double latDeg, double decRad)
        {
            double altRad = altDeg * DEG2RAD;
            double latRad = latDeg * DEG2RAD;
            double cosH = (Math.Sin(altRad) - Math.Sin(latRad) * Math.Sin(decRad)) /
                          (Math.Cos(latRad) * Math.Cos(decRad));
            if (cosH > 1.0 || cosH < -1.0) return 6.0;
            return (Math.Acos(cosH) * RAD2DEG) / 15.0;
        }

        private double RoundForward(double decimalHour)
        {
            int totalSeconds = (int)Math.Round(decimalHour * 3600);
            int h = (totalSeconds / 3600) % 24;
            int m = (totalSeconds % 3600) / 60;
            int s = totalSeconds % 60;
            if (s > 0) m++;
            return h + (m / 60.0);
        }

        private double RoundBackward(double decimalHour)
        {
            int totalSeconds = (int)Math.Floor(decimalHour * 3600);
            int h = (totalSeconds / 3600) % 24;
            int m = (totalSeconds % 3600) / 60;
            return h + (m / 60.0);
        }

        private struct PrayerSchedule
        {
            public double Fajr;
            public double Sunrise;
            public double Dhuhr;
            public double Asr;
            public double Maghrib;
            public double Isha;
        }

        private PrayerSchedule CalculateSchedule(DateTime date)
        {
            double tzOffsetHours = 5.5; // IST
            double jd = GetJulianDay(date.Year, date.Month, date.Day);
            double dec, eot;
            CalculateSolar(jd, out dec, out eot);

            double transitUTC = 12.0 - (lng / 15.0) - (eot / 60.0);
            double dhuhrTransit = FixHour(transitUTC + tzOffsetHours);

            double h0 = ComputeHourAngle(-0.8333, lat, dec);
            double sunriseRaw = FixHour(dhuhrTransit - h0);
            double maghribRaw = FixHour(dhuhrTransit + h0);

            double hFajr = ComputeHourAngle(-18.0, lat, dec);
            double fajrRaw = FixHour(dhuhrTransit - hFajr);

            double noonAltitude = 90.0 - Math.Abs(lat - (dec * RAD2DEG));
            double noonShadow = Math.Tan((90.0 - noonAltitude) * DEG2RAD);
            double asrAltitude = Math.Atan(1.0 / (2.0 + noonShadow)) * RAD2DEG;
            double hAsr = ComputeHourAngle(asrAltitude, lat, dec);
            double asrRaw = FixHour(dhuhrTransit + hAsr);

            double hIsha = ComputeHourAngle(-18.0, lat, dec);
            double ishaRaw = FixHour(dhuhrTransit + hIsha);

            PrayerSchedule s;
            s.Fajr = RoundForward(fajrRaw);
            s.Sunrise = RoundBackward(sunriseRaw);
            s.Dhuhr = RoundForward(dhuhrTransit + (1.0 / 60.0));
            s.Asr = RoundForward(asrRaw);
            s.Maghrib = RoundForward(maghribRaw + (3.0 / 60.0));
            s.Isha = RoundForward(ishaRaw);
            return s;
        }

        private DateTime DecToDateTime(double decHour, DateTime baseDate)
        {
            int h = (int)Math.Floor(decHour);
            double remM = (decHour - h) * 60.0;
            int m = (int)Math.Floor(remM);
            int s = (int)Math.Round((remM - m) * 60.0);
            if (s >= 60) { s = 0; m++; }
            if (m >= 60) { m = 0; h++; }
            return new DateTime(baseDate.Year, baseDate.Month, baseDate.Day, h % 24, m % 60, s % 60);
        }

        private string FormatTime12(DateTime dt)
        {
            int h = dt.Hour;
            string ampm = h >= 12 ? "PM" : "AM";
            int h12 = h % 12;
            if (h12 == 0) h12 = 12;
            return string.Format("{0}:{1:D2} {2}", h12, dt.Minute, ampm);
        }

        private void UpdateTimings()
        {
            DateTime now = DateTime.Now;
            PrayerSchedule today = CalculateSchedule(now);

            DateTime tFajr = DecToDateTime(today.Fajr, now);
            DateTime tSunrise = DecToDateTime(today.Sunrise, now);
            DateTime tDhuhr = DecToDateTime(today.Dhuhr, now);
            DateTime tAsr = DecToDateTime(today.Asr, now);
            DateTime tMaghrib = DecToDateTime(today.Maghrib, now);
            DateTime tIsha = DecToDateTime(today.Isha, now);

            DateTime tomorrow = now.AddDays(1);
            PrayerSchedule tmrw = CalculateSchedule(tomorrow);
            DateTime tNextFajr = DecToDateTime(tmrw.Fajr, tomorrow);

            DateTime yesterday = now.AddDays(-1);
            PrayerSchedule yday = CalculateSchedule(yesterday);
            DateTime tYesterdayIsha = DecToDateTime(yday.Isha, yesterday);
            DateTime tYesterdayMaghrib = DecToDateTime(yday.Maghrib, yesterday);

            // Calculate Islamic Midnight (Nisf-ul-Layl: exact midpoint between Sunset & Dawn as per Bahar-e-Shariat)
            DateTime tMidnight;
            if (now < tFajr)
            {
                TimeSpan nightSpan = tFajr - tYesterdayMaghrib;
                tMidnight = tYesterdayMaghrib + TimeSpan.FromSeconds(nightSpan.TotalSeconds / 2.0);
            }
            else
            {
                TimeSpan nightSpan = tNextFajr - tMaghrib;
                tMidnight = tMaghrib + TimeSpan.FromSeconds(nightSpan.TotalSeconds / 2.0);
            }

            // Update Schedule Peek Grid values
            DateTime[] peekDt = new DateTime[] { tFajr, tSunrise, tDhuhr, tAsr, tMaghrib, tIsha };
            for (int i = 0; i < 6; i++)
            {
                peekTimes[i].Text = FormatTime12(peekDt[i]);
            }

            string pName = "SALAH";
            DateTime windowStart = tDhuhr;
            DateTime windowEnd = tAsr;
            string nextName = "Dhuhr";

            bool isFriday = now.DayOfWeek == DayOfWeek.Friday;
            string dhuhrName = isFriday ? "JUMMAH" : "DHUHR";
            peekNames[2].Text = dhuhrName;

            // Determine Active Prayer Window
            int activePeekIndex = 2; // Default Dhuhr

            if (now >= tFajr && now < tSunrise)
            {
                pName = "FAJR";
                windowStart = tFajr;
                windowEnd = tSunrise;
                nextName = "Sunrise";
                activePeekIndex = 0;
            }
            else if (now >= tSunrise && now < tDhuhr)
            {
                pName = "NEXT: " + dhuhrName;
                windowStart = tSunrise;
                windowEnd = tDhuhr;
                nextName = dhuhrName;
                activePeekIndex = 1;
            }
            else if (now >= tDhuhr && now < tAsr)
            {
                pName = dhuhrName;
                windowStart = tDhuhr;
                windowEnd = tAsr;
                nextName = "Asr";
                activePeekIndex = 2;
            }
            else if (now >= tAsr && now < tMaghrib)
            {
                pName = "ASR";
                windowStart = tAsr;
                windowEnd = tMaghrib;
                nextName = "Maghrib";
                activePeekIndex = 3;
            }
            else if (now >= tMaghrib && now < tIsha)
            {
                pName = "MAGHRIB";
                windowStart = tMaghrib;
                windowEnd = tIsha;
                nextName = "Isha";
                activePeekIndex = 4;
            }
            else if (now >= tIsha)
            {
                pName = "ISHA";
                windowStart = tIsha;
                windowEnd = tNextFajr;
                nextName = "Fajr";
                activePeekIndex = 5;
            }
            else // Midnight to Fajr
            {
                pName = "ISHA";
                windowStart = tYesterdayIsha;
                windowEnd = tFajr;
                nextName = "Fajr";
                activePeekIndex = 5;
            }

            // Audio Chime on New Prayer Entry
            if (lastChimedPrayer != "" && lastChimedPrayer != pName && isSoundEnabled)
            {
                try { System.Media.SystemSounds.Asterisk.Play(); } catch { }
            }
            lastChimedPrayer = pName;

            // Highlight Active Prayer in Peek Panel
            for (int i = 0; i < 6; i++)
            {
                if (i == activePeekIndex)
                {
                    peekCells[i].Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(90, 16, 185, 129));
                    peekCells[i].BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129));
                    peekCells[i].BorderThickness = new Thickness(1);
                    peekNames[i].Foreground = System.Windows.Media.Brushes.White;
                }
                else
                {
                    peekCells[i].Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(20, 255, 255, 255));
                    peekCells[i].BorderBrush = System.Windows.Media.Brushes.Transparent;
                    peekCells[i].BorderThickness = new Thickness(0);
                    peekNames[i].Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184));
                }
            }

            // Deeper Fiqh Awareness: Check Prohibited Times (Awqat al-Nahy)
            bool isProhibited = false;
            string prohibitedMsg = "";

            if (now >= tSunrise && now < tSunrise.AddMinutes(20))
            {
                // 1. Sunrise Prohibition (from sunrise until sun rises 1 spear ~20 min as per Bahar-e-Shariat)
                isProhibited = true;
                prohibitedMsg = "🚫 SUNRISE PROHIBITION (Wait 20m for Ishraq)";
            }
            else if (now >= tDhuhr.AddMinutes(-10) && now < tDhuhr)
            {
                // 2. Zawal Prohibition (midday zenith ~10 min before Dhuhr)
                isProhibited = true;
                prohibitedMsg = "🚫 ZAWAL PROHIBITION (Midday zenith — All prayers prohibited)";
            }
            else if (now >= tMaghrib.AddMinutes(-20) && now < tMaghrib)
            {
                // 3. Sunset / Isfirar Prohibition (last 20m of Asr)
                isProhibited = true;
                prohibitedMsg = "⚠️ MAKRUH TIME (Asr sun pale — Avoid voluntary prayers)";
            }

            if (isProhibited)
            {
                prohibitedShield.Visibility = Visibility.Visible;
                txtProhibitedText.Text = prohibitedMsg;
            }
            else
            {
                prohibitedShield.Visibility = Visibility.Collapsed;
            }

            // Calculation of countdown
            TimeSpan diff = windowEnd > now ? (windowEnd - now) : TimeSpan.Zero;
            int totalSec = (int)diff.TotalSeconds;
            int totalMin = totalSec / 60;
            int hours = totalSec / 3600;
            int mins = (totalSec % 3600) / 60;
            int secs = totalSec % 60;

            // Calculation of progress ratio in current prayer window
            TimeSpan totalWindow = windowEnd > windowStart ? (windowEnd - windowStart) : TimeSpan.FromHours(2);
            TimeSpan elapsed = now > windowStart ? (now - windowStart) : TimeSpan.Zero;
            double progressRatio = Math.Max(0.01, Math.Min(0.99, elapsed.TotalSeconds / totalWindow.TotalSeconds));

            // Set progress gauge columns
            colElapsed.Width = new GridLength(progressRatio, GridUnitType.Star);
            colRemaining.Width = new GridLength(1.0 - progressRatio, GridUnitType.Star);

            // Per-Prayer Fiqh & Duration Thresholds
            int redThreshold = 10;
            int orangeThreshold = 20;
            int amberThreshold = 35;

            if (pName == "ASR")
            {
                // Asr: Last 20 minutes before Maghrib is Makruh Tahrimi (Isfirar ash-Shams)
                redThreshold = 10;
                orangeThreshold = 20;
                amberThreshold = 35;
            }
            else if (pName.Contains("DHUHR") || pName.Contains("JUMMAH"))
            {
                // Zuhr/Jummah: Long ~4-hour window; at 25m left >85% is already expired
                redThreshold = 12;
                orangeThreshold = 25;
                amberThreshold = 45;
            }
            else if (pName == "MAGHRIB")
            {
                // Maghrib: Short ~75m window; 44m left is >60% remaining -> Calm Emerald Green
                // Enters Golden Amber only at <= 25m, Sunset Orange at <= 15m, and Red Alert at < 8m.
                redThreshold = 8;
                orangeThreshold = 15;
                amberThreshold = 25;
            }
            else if (pName == "FAJR")
            {
                // Fajr: Strict cutoff at Sunrise
                redThreshold = 10;
                orangeThreshold = 18;
                amberThreshold = 30;
            }
            else if (pName == "ISHA")
            {
                // Isha: Long night window until Fajr
                redThreshold = 15;
                orangeThreshold = 30;
                amberThreshold = 50;
            }

            // Display Format: Live ticking MM:SS only when within red threshold
            string numStr;
            string unitStr;

            if (totalMin >= redThreshold)
            {
                if (hours > 0)
                {
                    numStr = mins > 0 ? string.Format("{0}h {1}m", hours, mins) : string.Format("{0}h", hours);
                    unitStr = "LEFT";
                }
                else
                {
                    numStr = totalMin.ToString();
                    unitStr = totalMin == 1 ? "MIN LEFT" : "MINS LEFT";
                }
            }
            else
            {
                // Final urgent threshold: Ticking MM:SS precision
                numStr = string.Format("{0:D2}:{1:D2}", totalMin, secs);
                unitStr = "REMAINING";
            }

            // 4-Tier Chromatic Spectrum
            System.Windows.Media.Color mainColor;
            System.Windows.Media.Color glowColor;
            System.Windows.Media.Color borderColor;

            pulseCounter++;

            if (totalMin < redThreshold)
            {
                // Tier 4: Crimson Alert (< redThreshold) + Subtle Breathing Pulse
                mainColor = System.Windows.Media.Color.FromRgb(239, 68, 68);
                glowColor = System.Windows.Media.Color.FromRgb(220, 38, 38);

                bool isPulseBright = (pulseCounter % 2) == 0;
                byte borderAlpha = (byte)(isPulseBright ? 190 : 80);
                borderColor = System.Windows.Media.Color.FromArgb(borderAlpha, 239, 68, 68);
                numGlow.Opacity = isPulseBright ? 0.85 : 0.45;
                numGlow.BlurRadius = isPulseBright ? 26 : 14;
            }
            else if (totalMin <= orangeThreshold)
            {
                // Tier 3: Sunset Orange / Coral
                mainColor = System.Windows.Media.Color.FromRgb(249, 115, 22);
                glowColor = System.Windows.Media.Color.FromRgb(234, 88, 12);
                borderColor = System.Windows.Media.Color.FromArgb(130, 249, 115, 22);
                numGlow.Opacity = 0.62;
                numGlow.BlurRadius = 20;
            }
            else if (totalMin <= amberThreshold)
            {
                // Tier 2: Solar Gold / Honey (Distinct bright gold #FBBF24, never mistaken for Orange)
                mainColor = System.Windows.Media.Color.FromRgb(251, 191, 36);
                glowColor = System.Windows.Media.Color.FromRgb(217, 119, 6);
                borderColor = System.Windows.Media.Color.FromArgb(95, 251, 191, 36);
                numGlow.Opacity = 0.55;
                numGlow.BlurRadius = 18;
            }
            else
            {
                // Tier 1: Emerald Neon (Safe / Mustahabb Window)
                mainColor = System.Windows.Media.Color.FromRgb(16, 185, 129);
                glowColor = System.Windows.Media.Color.FromRgb(5, 150, 105);
                borderColor = System.Windows.Media.Color.FromArgb(60, 16, 185, 129);
                numGlow.Opacity = 0.5;
                numGlow.BlurRadius = 18;
            }

            // Apply Chromatics
            txtPrayerName.Text = pName;
            txtCountdownNum.Text = numStr;
            txtCountdownNum.Foreground = new SolidColorBrush(mainColor);
            numGlow.Color = glowColor;

            outerCard.BorderBrush = new SolidColorBrush(borderColor);
            liveDot.Background = new SolidColorBrush(mainColor);
            ((DropShadowEffect)liveDot.Effect).Color = glowColor;

            progressBarFill.Background = new SolidColorBrush(mainColor);
            ((DropShadowEffect)progressBarFill.Effect).Color = glowColor;

            txtCountdownUnit.Text = unitStr;

            // Footer intelligence & Fasting detection
            if (pName == "ASR")
            {
                if (totalMin <= 20)
                {
                    txtSubtext.Text = string.Format("Iftar at {0}  •  ⚠️ Makruh Time  (Click for peek)", FormatTime12(windowEnd));
                }
                else
                {
                    txtSubtext.Text = string.Format("Iftar at {0} (Maghrib)  •  Next: Maghrib  (Click for peek)", FormatTime12(windowEnd));
                }
            }
            else if (pName == "MAGHRIB")
            {
                if (totalMin <= 15)
                {
                    txtSubtext.Text = string.Format("Ends at {0}  •  ⚠️ Makruh Time (Stars clustered)  (Click for peek)", FormatTime12(windowEnd));
                }
                else
                {
                    txtSubtext.Text = string.Format("Ends at {0}  •  Next: Isha  (Click for peek)", FormatTime12(windowEnd));
                }
            }
            else if (pName == "ISHA")
            {
                if (now > tMidnight)
                {
                    txtSubtext.Text = string.Format("Past Midnight (Makruh delay)  •  Sehri ends at {0}  (Click for peek)", FormatTime12(windowEnd));
                }
                else
                {
                    txtSubtext.Text = string.Format("Ends at {0} (Fajr)  •  Tahajjud window  (Click for peek)", FormatTime12(windowEnd));
                }
            }
            else if (now < tFajr)
            {
                if (now > tMidnight)
                {
                    txtSubtext.Text = string.Format("Past Midnight (Makruh delay)  •  Sehri ends at {0}  (Click for peek)", FormatTime12(tFajr));
                }
                else
                {
                    txtSubtext.Text = string.Format("Sehri ends at {0}  •  Tahajjud window  (Click for peek)", FormatTime12(tFajr));
                }
            }
            else if (now >= tSunrise && now < tDhuhr)
            {
                if (now < tSunrise.AddMinutes(20))
                {
                    txtSubtext.Text = string.Format("Wait 20m for Ishraq  •  {0} at {1}", dhuhrName, FormatTime12(tDhuhr));
                }
                else if (now < tSunrise.AddMinutes(50))
                {
                    txtSubtext.Text = string.Format("Ishraq Sunnah active  •  {0} at {1}", dhuhrName, FormatTime12(tDhuhr));
                }
                else if (now >= tDhuhr.AddMinutes(-10))
                {
                    txtSubtext.Text = string.Format("Zawal Zenith  •  {0} starts at {1}", dhuhrName, FormatTime12(tDhuhr));
                }
                else
                {
                    txtSubtext.Text = string.Format("Chasht (Duha) time  •  {0} at {1}", dhuhrName, FormatTime12(tDhuhr));
                }
            }
            else
            {
                txtSubtext.Text = string.Format("Ends at {0}  •  Next: {1}  (Click for peek)", FormatTime12(windowEnd), nextName);
            }

            // Update System Tray Tooltip
            if (notifyIcon != null)
            {
                string trayStr = string.Format("Namaz Times: {0} ({1} {2})", pName, numStr, unitStr);
                if (trayStr.Length > 63) trayStr = trayStr.Substring(0, 63);
                try { notifyIcon.Text = trayStr; } catch { }
            }
        }

        private static System.Threading.Mutex singleInstanceMutex;

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [STAThread]
        public static void Main()
        {
            bool isNewInstance;
            singleInstanceMutex = new System.Threading.Mutex(true, "NamazNativeWidget_SingleInstanceMutex", out isNewInstance);
            if (!isNewInstance)
            {
                try
                {
                    Process current = Process.GetCurrentProcess();
                    foreach (Process proc in Process.GetProcessesByName(current.ProcessName))
                    {
                        if (proc.Id != current.Id && proc.MainWindowHandle != IntPtr.Zero)
                        {
                            ShowWindow(proc.MainWindowHandle, 9); // SW_RESTORE
                            SetForegroundWindow(proc.MainWindowHandle);
                            break;
                        }
                    }
                }
                catch { }
                return;
            }

            try
            {
                Application app = new Application();
                WidgetWindow win = new WidgetWindow();
                app.Run(win);
            }
            catch (Exception ex)
            {
                try
                {
                    string log = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "widget_error.log");
                    File.WriteAllText(log, ex.ToString());
                }
                catch { }
            }
        }
    }
}
