param(
    [string] $SpritesRoot = "public/sprites",
    [int] $Tolerance = 40
)

$workspace = (Resolve-Path -LiteralPath ".").Path
$root = (Resolve-Path -LiteralPath $SpritesRoot).Path
if (-not $root.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "SpritesRoot must be inside the workspace."
}

Add-Type -ReferencedAssemblies @("System.Drawing", "System.Core") -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class SpriteBackgroundStripper
{
    public static long ProcessFile(string path, int tolerance)
    {
        byte[] sourceBytes = File.ReadAllBytes(path);
        using (var sourceStream = new MemoryStream(sourceBytes))
        using (var decoded = (Bitmap)Image.FromStream(sourceStream))
        using (var bitmap = new Bitmap(decoded.Width, decoded.Height, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(bitmap))
            {
                g.DrawImageUnscaled(decoded, 0, 0);
            }

            int w = bitmap.Width;
            int h = bitmap.Height;
            var rect = new Rectangle(0, 0, w, h);
            var data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            byte[] px;
            long transparentPixels = 0;

            try
            {
                int stride = data.Stride;
                int bytes = Math.Abs(stride) * h;
                px = new byte[bytes];
                Marshal.Copy(data.Scan0, px, 0, bytes);

                int[] c0 = RgbAt(px, stride, 0, 0);
                int[] c1 = RgbAt(px, stride, w - 1, 0);
                int[] c2 = RgbAt(px, stride, 0, h - 1);
                int[] c3 = RgbAt(px, stride, w - 1, h - 1);
                int[] bg = Similar(c0, c1, tolerance) && Similar(c0, c2, tolerance) && Similar(c0, c3, tolerance)
                    ? Average(c0, c1, c2, c3)
                    : c0;

                bool[] queued = new bool[w * h];
                int[] queue = new int[w * h];
                int head = 0;
                int tail = 0;

                Action<int, int> offer = (x, y) =>
                {
                    int i = y * w + x;
                    if (queued[i])
                    {
                        return;
                    }
                    int offset = y * stride + x * 4;
                    if (Math.Abs(px[offset + 2] - bg[0]) > tolerance ||
                        Math.Abs(px[offset + 1] - bg[1]) > tolerance ||
                        Math.Abs(px[offset] - bg[2]) > tolerance)
                    {
                        return;
                    }
                    queued[i] = true;
                    queue[tail++] = i;
                };

                for (int x = 0; x < w; x++)
                {
                    offer(x, 0);
                    offer(x, h - 1);
                }
                for (int y = 0; y < h; y++)
                {
                    offer(0, y);
                    offer(w - 1, y);
                }

                while (head < tail)
                {
                    int i = queue[head++];
                    int x = i % w;
                    int y = i / w;
                    int offset = y * stride + x * 4;
                    px[offset] = 0;
                    px[offset + 1] = 0;
                    px[offset + 2] = 0;
                    px[offset + 3] = 0;
                    transparentPixels++;

                    if (x > 0) offer(x - 1, y);
                    if (x + 1 < w) offer(x + 1, y);
                    if (y > 0) offer(x, y - 1);
                    if (y + 1 < h) offer(x, y + 1);
                }

                Marshal.Copy(px, 0, data.Scan0, bytes);
            }
            finally
            {
                bitmap.UnlockBits(data);
            }

            string temp = Path.Combine(Path.GetDirectoryName(path), Path.GetFileNameWithoutExtension(path) + ".transparent" + Path.GetExtension(path));
            bitmap.Save(temp, ImageFormat.Png);
            File.Copy(temp, path, true);
            File.Delete(temp);
            return transparentPixels;
        }
    }

    private static int[] RgbAt(byte[] px, int stride, int x, int y)
    {
        int offset = y * stride + x * 4;
        return new[] { (int)px[offset + 2], (int)px[offset + 1], (int)px[offset] };
    }

    private static bool Similar(int[] a, int[] b, int tolerance)
    {
        return Math.Abs(a[0] - b[0]) <= tolerance &&
               Math.Abs(a[1] - b[1]) <= tolerance &&
               Math.Abs(a[2] - b[2]) <= tolerance;
    }

    private static int[] Average(params int[][] colors)
    {
        int r = 0;
        int g = 0;
        int b = 0;
        foreach (var c in colors)
        {
            r += c[0];
            g += c[1];
            b += c[2];
        }
        return new[] { r / colors.Length, g / colors.Length, b / colors.Length };
    }
}
'@

$processed = 0
$transparentPixels = 0L
foreach ($file in Get-ChildItem -LiteralPath $root -Recurse -File -Filter "*.png") {
    if ($file.Name -like "*.transparent.png") {
        continue
    }
    $transparentPixels += [SpriteBackgroundStripper]::ProcessFile($file.FullName, $Tolerance)
    $processed++
}

Write-Output "Processed $processed PNG files; made $transparentPixels edge-connected background pixels transparent."
