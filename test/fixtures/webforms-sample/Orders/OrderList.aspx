<%@ Page Language="C#" MasterPageFile="~/Site.master" AutoEventWireup="true" CodeBehind="OrderList.aspx.cs" Inherits="WebFormsSample.Orders.OrderList" %>
<%@ Register TagPrefix="uc1" TagName="SearchBox" Src="~/Controls/SearchBox.ascx" %>
<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <uc1:SearchBox ID="search1" runat="server" />
    <asp:GridView ID="gvOrders" runat="server">
    </asp:GridView>
    <asp:Button ID="btnEdit" runat="server" Text="Edit" OnClick="btnEdit_Click" />
    <a href="OrderEdit.aspx">Edit order</a>
</asp:Content>
